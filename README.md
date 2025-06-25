# 🧠 Aiden — AI Onboarding Agent for SaaS Products

Aiden is an intelligent AI assistant built to onboard users across B2B SaaS products. It provides contextual help, answers product-related queries, and guides users through features — all in real-time.

This project is fully full-stack and production-ready, powered by FastAPI, React, Groq LLMs, and MongoDB.

---

## 🚀 Features

- 🧭 **Smart Onboarding**: Guides users step-by-step based on page context
- 💬 **Real-time Chat (WebSocket)**: Seamless interaction with an AI agent
- 📄 **REST API Support**: Fallback support for HTTP chat endpoints
- 🔁 **Session Context Memory**: Retains conversation history across sessions
- ⚙️ **Dynamic System Prompting**: Personalizes replies by page and user type
- 🧠 **LLM-Powered**: Uses Groq's blazing-fast `llama3-70b-8192` model
- 🌐 **Frontend-Backend Separation**: Clean React + FastAPI architecture

---

## 🛠️ Tech Stack

| Layer        | Technology                    |
|--------------|-------------------------------|
| **Frontend** | React, craco, Yarn            |
| **Backend**  | FastAPI, Uvicorn              |
| **AI**       | Groq LLM (`llama3-70b-8192`)  |
| **DB**       | MongoDB (via Motor)           |
| **Realtime** | WebSocket (FastAPI native)    |

---

## 📦 Project Structure

```
aiden-main/
├── backend/
│   ├── server.py            # FastAPI app & WebSocket logic
│   ├── .env                 # Secrets (Mongo, Groq)
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── src/                 # React app
│   ├── public/              # Static HTML & favicon
│   └── .env                 # REACT_APP_BACKEND_URL
```

---

## ⚙️ Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/yourname/aiden.git
cd aiden-main
```

---

### 2. Backend Setup

#### 🔧 Environment Variables

Create `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=aiden
GROQ_API_KEY=your_groq_api_key_here
```

#### 📦 Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### 🚀 Run FastAPI server

```bash
uvicorn server:app --host 0.0.0.0 --port 5000 --reload
```

---

### 3. Frontend Setup

#### 🔧 Environment Variables

Create `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

#### 📦 Install & Run

```bash
cd frontend
yarn install
yarn start
```

---

## 📡 API Overview

### WebSocket
- `ws://localhost:5000/api/ws/{session_id}`

### REST
- `POST /api/chat/{session_id}`
- `GET /api/session/{session_id}/history`
- `DELETE /api/session/{session_id}`
- `POST /api/onboarding-flows`
- `GET /api/onboarding-flows`

---

## 🔐 Security Notes

- Make sure to store secrets (Mongo URI, Groq API key) in `.env` and never commit them.
- Consider setting up HTTPS in production.

---

## 🚀 Deployment Tips

- Use **Render** or **Railway** for backend (FastAPI + Mongo)
- Deploy frontend on **Vercel** or **Netlify**
- Add domain + HTTPS
- Add logging and monitoring with LogRocket or Sentry (optional)

---

## 👨‍💻 Author

**You** — built with 💙, powered by LLMs.

---

## 📃 License

MIT — feel free to customize and deploy.