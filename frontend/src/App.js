import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User, Sparkles, HelpCircle, Zap } from 'lucide-react';
import './App.css';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // WebSocket connection
  useEffect(() => {
    if (!isOpen) return;

    const connectWebSocket = () => {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      
      // Create WebSocket URL - handle both HTTP and HTTPS
      let wsUrl;
      if (backendUrl.startsWith('https://')) {
        wsUrl = backendUrl.replace('https://', 'wss://') + `/api/ws/${sessionId}`;
      } else if (backendUrl.startsWith('http://')) {
        wsUrl = backendUrl.replace('http://', 'ws://') + `/api/ws/${sessionId}`;
      } else {
        // Fallback - assume it's a domain without protocol
        wsUrl = `wss://${backendUrl}/api/ws/${sessionId}`;
      }
      
      console.log('Connecting to WebSocket:', wsUrl);
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected successfully');
      };
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setIsTyping(false);
          setMessages(prev => [...prev, {
            text: data.content,
            sender: 'ai',
            timestamp: new Date(data.timestamp)
          }]);
        } else if (data.type === 'error') {
          setIsTyping(false);
          console.error('Chat error:', data.content);
          setMessages(prev => [...prev, {
            text: 'I apologize, but I encountered an error. Please try again.',
            sender: 'ai',
            timestamp: new Date()
          }]);
        }
      };
      
      ws.current.onclose = (event) => {
        setIsConnected(false);
        console.log('WebSocket disconnected:', event.code, event.reason);
        // Attempt to reconnect after 3 seconds if not a normal closure
        if (event.code !== 1000 && isOpen) {
          setTimeout(connectWebSocket, 3000);
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
      }
    };
  }, [sessionId, isOpen]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    
    // Get current page context
    const pageContext = {
      page_title: document.title,
      url: window.location.href,
      features: ['Dashboard', 'Settings', 'Analytics', 'Reports'] // Example features
    };

    const messageData = {
      message: input,
      page_context: pageContext,
      user_type: 'user'
    };

    setInput('');

    try {
      // Try WebSocket first
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(messageData));
      } else {
        // Fallback to REST API
        console.log('WebSocket not available, using REST API fallback');
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
        const response = await fetch(`${backendUrl}/api/chat/${sessionId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        });

        if (response.ok) {
          const data = await response.json();
          setIsTyping(false);
          setMessages(prev => [...prev, {
            text: data.response,
            sender: 'ai',
            timestamp: new Date(data.timestamp)
          }]);
        } else {
          throw new Error('Failed to send message via REST API');
        }
      }
    } catch (error) {
      setIsTyping(false);
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        text: 'I apologize, but I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      }]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { icon: HelpCircle, text: "Help me get started", message: "I'm new here. Can you help me get started with the platform?" },
    { icon: Zap, text: "Show me key features", message: "What are the main features I should know about?" },
    { icon: Sparkles, text: "Best practices", message: "What are some best practices for using this platform effectively?" }
  ];

  const handleQuickAction = (message) => {
    setInput(message);
    setTimeout(() => sendMessage(), 100);
  };

  return (
    <div className="app">
      {/* Main content area - simulated SaaS dashboard */}
      <div className="dashboard-simulation">
        <div className="dashboard-header">
          <h1 className="dashboard-title">SaaS Dashboard</h1>
          <div className="dashboard-nav">
            <span className="nav-item">Analytics</span>
            <span className="nav-item">Reports</span>
            <span className="nav-item">Settings</span>
          </div>
        </div>
        
        <div className="dashboard-content">
          <div className="dashboard-cards">
            <div className="dashboard-card">
              <h3>Total Users</h3>
              <p className="metric">1,234</p>
            </div>
            <div className="dashboard-card">
              <h3>Revenue</h3>
              <p className="metric">$56,789</p>
            </div>
            <div className="dashboard-card">
              <h3>Growth</h3>
              <p className="metric">+23.5%</p>
            </div>
          </div>
          
          <div className="dashboard-chart">
            <h3>Analytics Overview</h3>
            <div className="chart-placeholder">
              <p>📊 Interactive chart would be here</p>
              <p className="text-sm">This is a simulated SaaS dashboard to demonstrate the AI onboarding agent</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="chat-trigger"
          >
            <MessageCircle size={24} />
            <div className="chat-trigger-badge">
              <Sparkles size={12} />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`chat-widget ${isMinimized ? 'minimized' : ''}`}
          >
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="ai-avatar">
                  <Bot size={20} />
                </div>
                <div className="chat-header-text">
                  <h3>Aiden AI Assistant</h3>
                  <div className="connection-status">
                    <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                    <span>{isConnected ? 'WebSocket' : 'REST API'}</span>
                  </div>
                </div>
              </div>
              
              <div className="chat-header-controls">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="control-btn"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="control-btn"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            {!isMinimized && (
              <div className="chat-body">
                <div className="messages-container">
                  {messages.length === 0 && (
                    <div className="empty-state">
                      <div className="ai-avatar large">
                        <Bot size={32} />
                      </div>
                      <h4>Welcome to your AI assistant! 👋</h4>
                      <p>I'm here to help you navigate and understand your SaaS platform. Ask me anything!</p>
                      
                      <div className="quick-actions">
                        {quickActions.map((action, index) => (
                          <button
                            key={index}
                            onClick={() => handleQuickAction(action.message)}
                            className="quick-action-btn"
                          >
                            <action.icon size={16} />
                            {action.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`message ${message.sender}`}
                    >
                      <div className="message-avatar">
                        {message.sender === 'ai' ? (
                          <Bot size={16} />
                        ) : (
                          <User size={16} />
                        )}
                      </div>
                      <div className="message-content">
                        <div className="message-text">
                          {message.text}
                        </div>
                        <div className="message-timestamp">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="message ai typing"
                    >
                      <div className="message-avatar">
                        <Bot size={16} />
                      </div>
                      <div className="message-content">
                        <div className="typing-indicator">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="chat-input-container">
                  <div className="chat-input-wrapper">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message... (Press Enter to send)"
                      disabled={false}
                      className="chat-input"
                      rows={1}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim()}
                      className="send-button"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;