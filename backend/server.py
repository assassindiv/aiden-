from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid
from datetime import datetime, timedelta
import json
from groq import AsyncGroq
import uvicorn

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Groq client
groq_client = AsyncGroq(api_key=os.environ['GROQ_API_KEY'])

# Create the main app
app = FastAPI(title="AI Onboarding Agent", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str
    page_context: Optional[Dict] = None
    user_type: Optional[str] = "user"

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class OnboardingFlow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    steps: List[Dict]
    target_user_type: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Session management functions
async def get_session(session_id: str) -> Dict:
    session = await db.chat_sessions.find_one({"_id": session_id})
    if not session:
        new_session = {
            "_id": session_id,
            "context": [],
            "created_at": datetime.utcnow(),
            "last_accessed": datetime.utcnow()
        }
        await db.chat_sessions.insert_one(new_session)
        return new_session
    return session

async def update_session(session_id: str, message: Dict):
    await db.chat_sessions.update_one(
        {"_id": session_id},
        {
            "$push": {"context": message},
            "$set": {"last_accessed": datetime.utcnow()}
        }
    )

def create_system_prompt(page_context: Optional[Dict] = None, user_type: str = "user") -> str:
    base_prompt = """You are Aiden, an advanced AI onboarding assistant for B2B SaaS platforms. Your mission is to help users navigate, understand, and successfully onboard to their SaaS platform.

Core Capabilities:
- Provide contextual, page-aware guidance
- Offer step-by-step onboarding assistance
- Answer questions about features and functionality
- Suggest next best actions based on user context
- Help users overcome confusion and friction points

Personality:
- Friendly, professional, and encouraging
- Proactive in offering help
- Clear and concise in explanations
- Empathetic to user struggles

Response Guidelines:
- Keep responses under 150 words for better readability
- Offer specific, actionable advice
- Ask clarifying questions when needed
- Provide examples when helpful
- Use emojis sparingly but effectively"""

    if page_context:
        page_info = f"\n\nCurrent Page Context: {page_context.get('page_title', 'Unknown')} - {page_context.get('url', '')}"
        if page_context.get('features'):
            page_info += f"\nAvailable Features: {', '.join(page_context['features'])}"
        base_prompt += page_info

    if user_type and user_type != "user":
        base_prompt += f"\n\nUser Type: {user_type} - Tailor responses accordingly"

    return base_prompt

async def groq_generate(messages: List[Dict], model: str = "llama3-70b-8192") -> str:
    try:
        chat_completion = await groq_client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.7,
            max_tokens=1024,
            stream=False
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        logging.error(f"Groq API error: {str(e)}")
        return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment."

def trim_context(context: List[Dict], max_messages: int = 10) -> List[Dict]:
    """Keep only recent messages to manage context length"""
    if len(context) <= max_messages:
        return context
    
    # Always keep system messages
    system_messages = [msg for msg in context if msg.get("role") == "system"]
    other_messages = [msg for msg in context if msg.get("role") != "system"]
    
    # Keep most recent messages
    recent_messages = other_messages[-max_messages:]
    
    return system_messages + recent_messages

# WebSocket endpoint for real-time chat
@app.websocket("/api/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logging.info(f"WebSocket connected for session: {session_id}")
    
    try:
        # Send welcome message
        welcome_msg = {
            "type": "message",
            "content": "👋 Hi! I'm Aiden, your AI onboarding assistant. I'm here to help you navigate and understand your SaaS platform. What would you like to know?",
            "timestamp": datetime.utcnow().isoformat()
        }
        await websocket.send_text(json.dumps(welcome_msg))
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_message = message_data.get("message", "")
            page_context = message_data.get("page_context")
            user_type = message_data.get("user_type", "user")
            
            if not user_message:
                continue
            
            # Get session context
            session = await get_session(session_id)
            
            # Add user message to context
            user_msg = {
                "role": "user",
                "content": user_message,
                "timestamp": datetime.utcnow()
            }
            await update_session(session_id, user_msg)
            
            # Prepare messages for Groq
            context = session.get("context", [])
            
            # Create system message with current context
            system_prompt = create_system_prompt(page_context, user_type)
            system_msg = {"role": "system", "content": system_prompt}
            
            # Trim context and prepare for Groq
            trimmed_context = trim_context(context)
            groq_messages = [system_msg] + [{"role": msg["role"], "content": msg["content"]} for msg in trimmed_context if msg["role"] != "system"]
            
            # Generate response using Groq
            response = await groq_generate(groq_messages)
            
            # Add assistant response to context
            assistant_msg = {
                "role": "assistant",
                "content": response,
                "timestamp": datetime.utcnow()
            }
            await update_session(session_id, assistant_msg)
            
            # Send response to client
            response_msg = {
                "type": "message",
                "content": response,
                "timestamp": datetime.utcnow().isoformat()
            }
            await websocket.send_text(json.dumps(response_msg))
            
    except WebSocketDisconnect:
        logging.info(f"WebSocket disconnected for session: {session_id}")
    except Exception as e:
        logging.error(f"WebSocket error: {str(e)}")
        try:
            error_msg = {
                "type": "error",
                "content": "I encountered an error. Please refresh and try again."
            }
            await websocket.send_text(json.dumps(error_msg))
        except:
            pass

# REST API endpoints
@api_router.post("/chat/{session_id}", response_model=ChatResponse)
async def chat_endpoint(session_id: str, request: ChatRequest):
    """Alternative REST endpoint for chat"""
    try:
        session = await get_session(session_id)
        
        # Add user message
        user_msg = {
            "role": "user",
            "content": request.message,
            "timestamp": datetime.utcnow()
        }
        await update_session(session_id, user_msg)
        
        # Get context and generate response
        context = session.get("context", [])
        system_prompt = create_system_prompt(request.page_context, request.user_type)
        system_msg = {"role": "system", "content": system_prompt}
        
        trimmed_context = trim_context(context)
        groq_messages = [system_msg] + [{"role": msg["role"], "content": msg["content"]} for msg in trimmed_context if msg["role"] != "system"]
        
        response = await groq_generate(groq_messages)
        
        # Add assistant response
        assistant_msg = {
            "role": "assistant",
            "content": response,
            "timestamp": datetime.utcnow()
        }
        await update_session(session_id, assistant_msg)
        
        return ChatResponse(response=response, session_id=session_id)
        
    except Exception as e:
        logging.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process chat request")

@api_router.get("/session/{session_id}/history")
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    try:
        session = await get_session(session_id)
        return {"history": session.get("context", [])}
    except Exception as e:
        logging.error(f"Get history error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chat history")

@api_router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a chat session"""
    try:
        await db.chat_sessions.delete_one({"_id": session_id})
        return {"message": "Session cleared successfully"}
    except Exception as e:
        logging.error(f"Clear session error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear session")

@api_router.post("/onboarding-flows", response_model=OnboardingFlow)
async def create_onboarding_flow(flow: OnboardingFlow):
    """Create a new onboarding flow"""
    try:
        await db.onboarding_flows.insert_one(flow.dict())
        return flow
    except Exception as e:
        logging.error(f"Create flow error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create onboarding flow")

@api_router.get("/onboarding-flows", response_model=List[OnboardingFlow])
async def get_onboarding_flows():
    """Get all onboarding flows"""
    try:
        flows = await db.onboarding_flows.find().to_list(100)
        return [OnboardingFlow(**flow) for flow in flows]
    except Exception as e:
        logging.error(f"Get flows error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve onboarding flows")

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
if __name__ == "__main__":  
      uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)
