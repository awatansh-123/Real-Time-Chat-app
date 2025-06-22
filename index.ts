export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Room {
  _id: string;
  name: string;
  description: string;
  createdBy: User;
  members: User[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  content: string;
  sender: User;
  room?: Room;
  recipient?: User;
  messageType: 'room' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export interface ChatState {
  messages: Message[];
  rooms: Room[];
  activeRoom: string | null;
  activePrivateChat: string | null;
  onlineUsers: User[];
  typingUsers: string[];
  setActiveRoom: (roomId: string) => void;
  setActivePrivateChat: (userId: string) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setRooms: (rooms: Room[]) => void;
  setOnlineUsers: (users: User[]) => void;
  addTypingUser: (username: string) => void;
  removeTypingUser: (username: string) => void;
}