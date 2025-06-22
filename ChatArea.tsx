import React, { useState, useEffect, useRef } from 'react';
import { Send, Hash, User } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { messageAPI } from '../services/api';
import { socketService } from '../services/socket';
import { format } from 'date-fns';

const ChatArea: React.FC = () => {
  const { user } = useAuthStore();
  const {
    messages,
    rooms,
    activeRoom,
    activePrivateChat,
    typingUsers,
    setMessages,
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRoomData = rooms.find(room => room._id === activeRoom);
  const isPrivateChat = !!activePrivateChat;

  useEffect(() => {
    if (activeRoom) {
      loadRoomMessages(activeRoom);
    } else if (activePrivateChat) {
      loadPrivateMessages(activePrivateChat);
    } else {
      setMessages([]);
    }
  }, [activeRoom, activePrivateChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadRoomMessages = async (roomId: string) => {
    try {
      const response = await messageAPI.getRoomMessages(roomId);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load room messages:', error);
    }
  };

  const loadPrivateMessages = async (userId: string) => {
    try {
      const response = await messageAPI.getPrivateMessages(userId);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load private messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const messageData = {
      content: message.trim(),
      messageType: isPrivateChat ? 'private' as const : 'room' as const,
      ...(isPrivateChat 
        ? { recipientId: activePrivateChat } 
        : { roomId: activeRoom }
      )
    };

    socketService.sendMessage(messageData);
    setMessage('');

    // Stop typing
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    socketService.stopTyping(messageData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    // Handle typing indicators
    const typingData = {
      messageType: isPrivateChat ? 'private' as const : 'room' as const,
      ...(isPrivateChat 
        ? { recipientId: activePrivateChat } 
        : { roomId: activeRoom }
      )
    };

    socketService.startTyping(typingData);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      socketService.stopTyping(typingData);
    }, 1000);

    setTypingTimeout(timeout);
  };

  if (!activeRoom && !activePrivateChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Hash className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Welcome to ChatApp
          </h3>
          <p className="text-gray-500">
            Select a room or start a direct message to begin chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          {isPrivateChat ? (
            <>
              <User className="w-5 h-5 text-gray-500" />
              <div>
                <h2 className="font-semibold text-gray-800">
                  Direct Message
                </h2>
                <p className="text-sm text-gray-500">Private conversation</p>
              </div>
            </>
          ) : (
            <>
              <Hash className="w-5 h-5 text-gray-500" />
              <div>
                <h2 className="font-semibold text-gray-800">
                  {activeRoomData?.name}
                </h2>
                <p className="text-sm text-gray-500">
                  {activeRoomData?.description || `${activeRoomData?.members.length} members`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`flex items-start space-x-3 ${
              msg.sender.id === user?.id ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <img
              src={msg.sender.avatar}
              alt={msg.sender.username}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.sender.id === user?.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span className={`text-sm font-medium ${
                  msg.sender.id === user?.id ? 'text-blue-100' : 'text-gray-700'
                }`}>
                  {msg.sender.username}
                </span>
                <span className={`text-xs ${
                  msg.sender.id === user?.id ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {format(new Date(msg.createdAt), 'HH:mm')}
                </span>
              </div>
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100">
              <p className="text-sm text-gray-600">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <input
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder={`Message ${isPrivateChat ? 'direct message' : `#${activeRoomData?.name}`}`}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatArea;