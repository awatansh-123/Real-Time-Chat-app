import React, { useState, useEffect } from 'react';
import { Hash, Plus, Users, MessageCircle, Settings, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { roomAPI, userAPI } from '../services/api';
import { socketService } from '../services/socket';
import CreateRoomModal from './CreateRoomModal';
import { User as UserType } from '../types';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { 
    rooms, 
    activeRoom, 
    activePrivateChat, 
    onlineUsers, 
    setActiveRoom, 
    setActivePrivateChat, 
    setRooms 
  } = useChatStore();
  
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [activeTab, setActiveTab] = useState<'rooms' | 'users'>('rooms');

  useEffect(() => {
    loadRooms();
    loadUsers();
  }, []);

  const loadRooms = async () => {
    try {
      const response = await roomAPI.getRooms();
      setRooms(response.data);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userAPI.getUsers();
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleRoomClick = (roomId: string) => {
    setActiveRoom(roomId);
    socketService.joinRoom(roomId);
  };

  const handleUserClick = (userId: string) => {
    setActivePrivateChat(userId);
  };

  const handleLogout = () => {
    socketService.disconnect();
    logout();
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-800">ChatApp</h1>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        {/* User Info */}
        <div className="flex items-center space-x-3">
          <img
            src={user?.avatar}
            alt={user?.username}
            className="w-8 h-8 rounded-full"
          />
          <div>
            <p className="font-medium text-gray-800">{user?.username}</p>
            <p className="text-sm text-green-500">Online</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-4 space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'rooms'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>Rooms</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Direct</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'rooms' ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Rooms
              </h2>
              <button
                onClick={() => setShowCreateRoom(true)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1">
              {rooms.map((room) => (
                <button
                  key={room._id}
                  onClick={() => handleRoomClick(room._id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeRoom === room._id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{room.name}</p>
                    <p className="text-sm text-gray-500 truncate">{room.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
              Direct Messages
            </h2>
            
            <div className="space-y-1">
              {allUsers.map((user) => {
                const isOnline = onlineUsers.some(u => u.username === user.username);
                return (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activePrivateChat === user.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-8 h-8 rounded-full"
                      />
                      <div
                        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-400' : 'bg-gray-300'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.username}</p>
                      <p className={`text-sm truncate ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onRoomCreated={loadRooms}
        />
      )}
    </div>
  );
};

export default Sidebar;