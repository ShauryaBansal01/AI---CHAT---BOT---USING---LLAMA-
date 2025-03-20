import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  // State management
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [attachedPdf, setAttachedPdf] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.2-vision');
  const [processingPdf, setProcessingPdf] = useState(false);
  
  // Sidebar chat history state
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingChatName, setEditingChatName] = useState('');
  
  // Refs
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const editInputRef = useRef(null);

  // Generate a session ID and initial chat on component mount
  useEffect(() => {
    const newSessionId = Date.now().toString();
    setSessionId(newSessionId);
    
    // Create initial chat
    const initialChat = {
      id: newSessionId,
      name: "New Chat",
      date: new Date(),
      messages: [],
      isPdfMode: false,
      pdfName: '',
      model: 'llama3.2-vision'
    };
    
    setChatHistory([initialChat]);
    setCurrentChat(initialChat);
  }, []);

  // Focus edit input when editing chat name
  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingChatId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create a new chat
  const createNewChat = () => {
    const newChatId = Date.now().toString();
    const newChat = {
      id: newChatId,
      name: "New Chat",
      date: new Date(),
      messages: [],
      isPdfMode: false,
      pdfName: '',
      model: selectedModel
    };
    
    // Save current chat state before switching
    if (currentChat) {
      saveCurrentChatState();
    }
    
    setChatHistory(prevHistory => [newChat, ...prevHistory]);
    setCurrentChat(newChat);
    setSessionId(newChatId);
    setMessages([]);
    setIsPdfMode(false);
    setPdfText('');
    setPdfName('');
    setAttachedPdf(null);
    setSelectedModel('llama3.2-vision');
  };

  // Save current chat state
  const saveCurrentChatState = () => {
    if (!currentChat) return;
    
    const updatedChat = {
      ...currentChat,
      messages: messages,
      isPdfMode: isPdfMode,
      pdfName: pdfName,
      model: selectedModel
    };
    
    setChatHistory(prevHistory => 
      prevHistory.map(chat => 
        chat.id === currentChat.id ? updatedChat : chat
      )
    );
  };

  // Switch to a different chat
  const switchToChat = (chatId) => {
    // Save current chat state first
    saveCurrentChatState();
    
    // Find the chat to switch to
    const targetChat = chatHistory.find(chat => chat.id === chatId);
    if (!targetChat) return;
    
    // Update current state
    setCurrentChat(targetChat);
    setSessionId(targetChat.id);
    setMessages(targetChat.messages);
    setIsPdfMode(targetChat.isPdfMode);
    setPdfName(targetChat.pdfName);
    setSelectedModel(targetChat.model || 'llama3.2-vision');
  };

  // Start editing chat name
  const startEditingChatName = (chatId, currentName, e) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingChatName(currentName);
  };

  // Save edited chat name
  const saveEditedChatName = () => {
    if (!editingChatId) return;
    
    setChatHistory(prevHistory => 
      prevHistory.map(chat => 
        chat.id === editingChatId 
          ? { ...chat, name: editingChatName.trim() || "Untitled Chat" } 
          : chat
      )
    );
    
    // If editing current chat, update current chat as well
    if (currentChat && currentChat.id === editingChatId) {
      setCurrentChat(prevChat => ({ 
        ...prevChat, 
        name: editingChatName.trim() || "Untitled Chat" 
      }));
    }
    
    setEditingChatId(null);
    setEditingChatName('');
  };

  // Cancel editing chat name
  const cancelEditingChatName = () => {
    setEditingChatId(null);
    setEditingChatName('');
  };

  // Delete a chat
  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    
    // Filter out the chat to delete
    const newHistory = chatHistory.filter(chat => chat.id !== chatId);
    setChatHistory(newHistory);
    
    // If we're deleting the current chat, switch to the most recent chat
    if (currentChat && currentChat.id === chatId) {
      if (newHistory.length > 0) {
        switchToChat(newHistory[0].id);
      } else {
        // If no chats left, create a new one
        createNewChat();
      }
    }
  };

  // Group chats by date category
  const groupChatsByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const groups = {
      today: [],
      yesterday: [],
      previous7Days: [],
      older: []
    };
    
    chatHistory.forEach(chat => {
      const chatDate = new Date(chat.date);
      chatDate.setHours(0, 0, 0, 0);
      
      if (chatDate.getTime() === today.getTime()) {
        groups.today.push(chat);
      } else if (chatDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(chat);
      } else if (chatDate >= weekAgo) {
        groups.previous7Days.push(chat);
      } else {
        groups.older.push(chat);
      }
    });
    
    return groups;
  };

  // Handle key press for editing chat name
  const handleEditKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveEditedChatName();
    } else if (e.key === 'Escape') {
      cancelEditingChatName();
    }
  };

  // Handle model selection
  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
    
    // Update current chat model preference
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        model: e.target.value
      }));
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (inputText.trim() === '' && !attachedImage) return;
    if (isLoading) return; // Prevent multiple submissions

    // Display user message immediately
    const newMessage = {
      id: Date.now(),
      text: inputText,
      image: attachedImage,
      sender: 'user',
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    
    // Also update the chat history
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        messages: updatedMessages
      }));
    }
    
    setIsLoading(true);

    try {
      // Different handling based on mode
      if (isPdfMode && pdfText) {
        // PDF discussion mode
        await handlePdfQuestion(inputText);
      } else {
        // Regular chat mode
        await handleRegularChat(inputText, attachedImage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error message
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, there was an error connecting to the chatbot. Please try again.",
        sender: 'bot',
      };
      
      const withErrorMessage = [...updatedMessages, errorMessage];
      setMessages(withErrorMessage);
      
      if (currentChat) {
        setCurrentChat(prevChat => ({
          ...prevChat,
          messages: withErrorMessage
        }));
      }
    } finally {
      // Clear input and image after sending
      setInputText('');
      setAttachedImage(null);
      setIsLoading(false);
    }
  };

  // Handle regular chat mode
  const handleRegularChat = async (text, image) => {
    // Prepare request data
    const requestData = {
      text: text,
      sessionId: sessionId,
      model: selectedModel
    };

    // Add image if present
    if (image) {
      requestData.image = image;
    }

    // Send request to backend
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();

    // Display bot response
    const botResponse = {
      id: Date.now() + 1,
      text: data.response,
      sender: 'bot',
    };
    
    const updatedMessages = [...messages, botResponse];
    setMessages(updatedMessages);
    
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        messages: updatedMessages
      }));
    }
  };

  // Handle PDF analysis questions
  const handlePdfQuestion = async (question) => {
    const requestData = {
      text: question,
      pdfText: pdfText,
      model: "mistral:latest" // Using Mistral for PDF analysis
    };

    // Send request to backend
    const response = await fetch('http://localhost:5000/api/pdf_question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();

    // Display bot response
    const botResponse = {
      id: Date.now() + 1,
      text: data.response,
      sender: 'bot',
    };
    
    const updatedMessages = [...messages, botResponse];
    setMessages(updatedMessages);
    
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        messages: updatedMessages
      }));
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

// Modified handlePdfUpload function to automatically switch to Mistral
const handlePdfUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Set loading state
  setProcessingPdf(true);
  setPdfName(file.name);
  
  // Automatically switch to Mistral model for PDF processing
  setSelectedModel("mistral:latest");
  
  // Create FormData object
  const formData = new FormData();
  formData.append('pdf', file);
  
  try {
    // Upload PDF and get extracted text
    const response = await fetch('http://localhost:5000/api/upload_pdf', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload PDF');
    }
    
    const data = await response.json();
    
    // Store the extracted text
    setPdfText(data.text);
    
    // Switch to PDF mode
    setIsPdfMode(true);
    
    // Update current chat with Mistral model
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        isPdfMode: true,
        pdfName: file.name,
        model: "mistral:latest" // Set model to Mistral in chat data
      }));
    }
    
    // Display system message
    const systemMessage = {
      id: Date.now(),
      text: `PDF "${file.name}" successfully loaded. The document has been analyzed and you can now ask questions about its content. Model automatically switched to Mistral.`,
      sender: 'bot',
    };
    
    // Add initial analysis
    const analysisMessage = {
      id: Date.now() + 1,
      text: `**Initial Analysis**\n\n${data.analysis}`,
      sender: 'bot',
    };
    
    const updatedMessages = [...messages, systemMessage, analysisMessage];
    setMessages(updatedMessages);
    
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        messages: updatedMessages
      }));
    }
    
  } catch (error) {
    console.error('Error uploading PDF:', error);
    
    // Show error message
    const errorMessage = {
      id: Date.now(),
      text: "Sorry, there was an error processing the PDF. Please try again.",
      sender: 'bot',
    };
    
    const updatedMessages = [...messages, errorMessage];
    setMessages(updatedMessages);
    
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        messages: updatedMessages
      }));
    }
  } finally {
    setProcessingPdf(false);
  }
};

  // Handle key press (send on Enter)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Reset chat history
  const handleResetChat = async () => {
    try {
      await fetch('http://localhost:5000/api/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      
      // Create a new chat
      createNewChat();
    } catch (error) {
      console.error('Error resetting chat:', error);
    }
  };

  // Exit PDF mode
  const exitPdfMode = () => {
    setIsPdfMode(false);
    setPdfText('');
    setPdfName('');
    setAttachedPdf(null);
    
    // Update current chat
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        isPdfMode: false,
        pdfName: ''
      }));
    }
    
    // Display system message
    const systemMessage = {
      id: Date.now(),
      text: "Exited PDF mode. You're now back in normal chat mode.",
      sender: 'bot',
    };
    
    const updatedMessages = [...messages, systemMessage];
    setMessages(updatedMessages);
    
    if (currentChat) {
      setCurrentChat(prevChat => ({
        ...prevChat,
        messages: updatedMessages
      }));
    }
  };
  
  // Get grouped chats for sidebar
  const groupedChats = groupChatsByDate();
  
  return (
    <div className="flex h-screen w-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="font-bold">SnapGPT</span>
        </div>
        
        <div className="p-2">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center p-3 rounded-md hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {/* Today's chats */}
          {groupedChats.today.length > 0 && (
            <>
              <div className="text-xs uppercase text-gray-400 font-semibold px-3 pt-4 pb-2">Today</div>
              <div className="py-1">
                {groupedChats.today.map(chat => (
                  <div 
                    key={chat.id}
                    className={`px-3 py-2 rounded-md hover:bg-gray-700 cursor-pointer flex justify-between items-center group ${
                      currentChat && currentChat.id === chat.id ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => switchToChat(chat.id)}
                  >
                    {editingChatId === chat.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="bg-gray-600 text-white px-2 py-1 rounded w-full"
                        value={editingChatName}
                        onChange={(e) => setEditingChatName(e.target.value)}
                        onBlur={saveEditedChatName}
                        onKeyDown={handleEditKeyPress}
                      />
                    ) : (
                      <>
                        <span className="truncate flex-1">
                          {chat.isPdfMode ? `PDF: ${chat.pdfName}` : chat.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => startEditingChatName(chat.id, chat.name, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => deleteChat(chat.id, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Yesterday's chats */}
          {groupedChats.yesterday.length > 0 && (
            <>
              <div className="text-xs uppercase text-gray-400 font-semibold px-3 pt-4 pb-2">Yesterday</div>
              <div className="py-1">
                {groupedChats.yesterday.map(chat => (
                  <div 
                    key={chat.id}
                    className={`px-3 py-2 rounded-md hover:bg-gray-700 cursor-pointer flex justify-between items-center group ${
                      currentChat && currentChat.id === chat.id ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => switchToChat(chat.id)}
                  >
                    {editingChatId === chat.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="bg-gray-600 text-white px-2 py-1 rounded w-full"
                        value={editingChatName}
                        onChange={(e) => setEditingChatName(e.target.value)}
                        onBlur={saveEditedChatName}
                        onKeyDown={handleEditKeyPress}
                      />
                    ) : (
                      <>
                        <span className="truncate flex-1">
                          {chat.isPdfMode ? `PDF: ${chat.pdfName}` : chat.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => startEditingChatName(chat.id, chat.name, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => deleteChat(chat.id, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Previous 7 days chats */}
          {groupedChats.previous7Days.length > 0 && (
            <>
              <div className="text-xs uppercase text-gray-400 font-semibold px-3 pt-4 pb-2">Previous 7 Days</div>
              <div className="py-1">
                {groupedChats.previous7Days.map(chat => (
                  <div 
                    key={chat.id}
                    className={`px-3 py-2 rounded-md hover:bg-gray-700 cursor-pointer flex justify-between items-center group ${
                      currentChat && currentChat.id === chat.id ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => switchToChat(chat.id)}
                  >
                    {editingChatId === chat.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="bg-gray-600 text-white px-2 py-1 rounded w-full"
                        value={editingChatName}
                        onChange={(e) => setEditingChatName(e.target.value)}
                        onBlur={saveEditedChatName}
                        onKeyDown={handleEditKeyPress}
                      />
                    ) : (
                      <>
                        <span className="truncate flex-1">
                          {chat.isPdfMode ? `PDF: ${chat.pdfName}` : chat.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => startEditingChatName(chat.id, chat.name, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => deleteChat(chat.id, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Older chats */}
          {groupedChats.older.length > 0 && (
            <>
              <div className="text-xs uppercase text-gray-400 font-semibold px-3 pt-4 pb-2">Older</div>
              <div className="py-1">
                {groupedChats.older.map(chat => (
                  <div 
                    key={chat.id}
                    className={`px-3 py-2 rounded-md hover:bg-gray-700 cursor-pointer flex justify-between items-center group ${
                      currentChat && currentChat.id === chat.id ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => switchToChat(chat.id)}
                  >
                    {editingChatId === chat.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="bg-gray-600 text-white px-2 py-1 rounded w-full"
                        value={editingChatName}
                        onChange={(e) => setEditingChatName(e.target.value)}
                        onBlur={saveEditedChatName}
                        onKeyDown={handleEditKeyPress}
                      />
                    ) : (
                      <>
                        <span className="truncate flex-1">
                          {chat.isPdfMode ? `PDF: ${chat.pdfName}` : chat.name}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-1 text-gray-300 hover:text-white"
                            onClick={(e) => startEditingChatName(chat.id, chat.name, e)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header bar */}
        <div className="bg-white dark:bg-gray-800 shadow px-4 py-2 flex items-center justify-between">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              {isPdfMode ? `PDF Discussion: ${pdfName}` : (currentChat ? currentChat.name : 'New Chat')}
            </h2>
            {isPdfMode && (
              <button 
                onClick={exitPdfMode}
                className="ml-3 px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Exit PDF Mode
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <label htmlFor="model" className="mr-2 text-sm text-gray-600 dark:text-gray-300">Model:</label>
              <select 
                id="model"
                value={selectedModel}
                onChange={handleModelChange}
                className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm"
              >
                <option value="llama3.2-vision">Llama3.2 Vision</option>
                <option value="mistral:latest">Mistral</option>
              </select>
            </div>
            
            <button 
              onClick={handleResetChat}
              className="flex items-center px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="mt-2 text-xl font-medium text-gray-900 dark:text-white">Start a conversation</h3>
                <p className="mt-1 text-gray-500 dark:text-gray-400">
                  {isPdfMode 
                    ? "Ask questions about the uploaded PDF document." 
                    : "You can chat with the AI, upload images for analysis, or upload a PDF document."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-3xl rounded-lg px-4 py-3 ${
                      message.sender === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {message.image && (
                      <div className="mb-2">
                        <img 
                          src={message.image} 
                          alt="Uploaded" 
                          className="max-h-60 rounded-md"
                        />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap markdown-content">
                      {message.text}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* PDF processing indicator */}
        {processingPdf && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
              <div className="flex items-center">
                <svg className="animate-spin h-6 w-6 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-700 dark:text-gray-200">Processing PDF...</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This may take a moment depending on the PDF size and complexity.</p>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="relative flex items-center">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isPdfMode ? "Ask a question about the PDF..." : "Type a message..."}
              className="flex-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md py-2 px-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="1"
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />
            
            <div className="absolute right-24 flex space-x-2">
              {!isPdfMode && (
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
                  title="Upload Image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
              
              {!isPdfMode && (
                <button
                  onClick={() => pdfInputRef.current.click()}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
                  title="Upload PDF"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              )}
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={isLoading}
              className="ml-2 bg-blue-500 text-white rounded-md p-2 hover:bg-blue-600 transition-colors disabled:bg-blue-300"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Display attached image preview */}
          {attachedImage && (
            <div className="mt-2 relative inline-block">
              <img src={attachedImage} alt="Attached" className="h-16 rounded" />
              <button
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Hidden file inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={pdfInputRef}
            onChange={handlePdfUpload}
            accept=".pdf"
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}

export default App;