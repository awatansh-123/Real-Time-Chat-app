import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Message, User } from '../types';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    const { token } = useAuthStore.getState();
    if (!token) return;

    this.socket = io('http://localhost:3001', {
      auth: { token },
    });

    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('receive_message', (message: Message) => {
      useChatStore.getState().addMessage(message);
    });

    this.socket.on('users_updated', (users: User[]) => {
      useChatStore.getState().setOnlineUsers(users);
    });

    this.socket.on('user_typing', ({ username }: { username: string }) => {
      useChatStore.getState().addTypingUser(username);
    });

    this.socket.on('user_stop_typing', ({ username }: { username: string }) => {
      useChatStore.getState().removeTypingUser(username);
    });

    this.socket.on('error', (error: string) => {
      console.error('Socket error:', error);
    });
  }

  sendMessage(data: {
    content: string;
    roomId?: string;
    recipientId?: string;
    messageType: 'room' | 'private';
  }) {
    if (this.socket) {
      this.socket.emit('send_message', data);
    }
  }

  joinRoom(roomId: string) {
    if (this.socket) {
      this.socket.emit('join_room', roomId);
    }
  }

  startTyping(data: {
    roomId?: string;
    recipientId?: string;
    messageType: 'room' | 'private';
  }) {
    if (this.socket) {
      this.socket.emit('typing_start', data);
    }
  }

  stopTyping(data: {
    roomId?: string;
    recipientId?: string;
    messageType: 'room' | 'private';
  }) {
    if (this.socket) {
      this.socket.emit('typing_stop', data);
    }
  }
}

export const socketService = new SocketService();