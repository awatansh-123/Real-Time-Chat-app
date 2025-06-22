import { create } from 'zustand';
import { ChatState, Message, Room, User } from '../types';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  rooms: [],
  activeRoom: null,
  activePrivateChat: null,
  onlineUsers: [],
  typingUsers: [],
  
  setActiveRoom: (roomId: string) =>
    set({ activeRoom: roomId, activePrivateChat: null }),
  
  setActivePrivateChat: (userId: string) =>
    set({ activePrivateChat: userId, activeRoom: null }),
  
  addMessage: (message: Message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  
  setMessages: (messages: Message[]) =>
    set({ messages }),
  
  setRooms: (rooms: Room[]) =>
    set({ rooms }),
  
  setOnlineUsers: (users: User[]) =>
    set({ onlineUsers: users }),
  
  addTypingUser: (username: string) =>
    set((state) => ({
      typingUsers: [...state.typingUsers.filter(u => u !== username), username],
    })),
  
  removeTypingUser: (username: string) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter(u => u !== username),
    })),
}));