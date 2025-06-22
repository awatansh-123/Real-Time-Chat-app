import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Room Schema
const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPrivate: { type: Boolean, default: false }
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messageType: { type: String, enum: ['room', 'private'], required: true },
  readBy: [{ 
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Socket.IO middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Track online users
const onlineUsers = new Map();
const typingUsers = new Map();

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`User ${socket.username} connected`);
  
  // Mark user as online
  await User.findByIdAndUpdate(socket.userId, { isOnline: true });
  onlineUsers.set(socket.userId, { socketId: socket.id, username: socket.username });
  
  // Broadcast updated user list
  io.emit('users_updated', Array.from(onlineUsers.values()).map(user => ({
    username: user.username,
    isOnline: true
  })));

  // Join user to their rooms
  const userRooms = await Room.find({ members: socket.userId });
  userRooms.forEach(room => {
    socket.join(room._id.toString());
  });

  // Handle joining rooms
  socket.on('join_room', async (roomId) => {
    try {
      const room = await Room.findById(roomId);
      if (room && room.members.includes(socket.userId)) {
        socket.join(roomId);
        socket.emit('joined_room', roomId);
      }
    } catch (error) {
      socket.emit('error', 'Failed to join room');
    }
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { content, roomId, recipientId, messageType } = data;
      
      const messageData = {
        content,
        sender: socket.userId,
        messageType
      };

      if (messageType === 'room') {
        messageData.room = roomId;
      } else {
        messageData.recipient = recipientId;
      }

      const message = new Message(messageData);
      await message.save();
      
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username avatar')
        .populate('recipient', 'username')
        .populate('room', 'name');

      if (messageType === 'room') {
        io.to(roomId).emit('receive_message', populatedMessage);
      } else {
        // Send to recipient if online
        const recipientSocket = onlineUsers.get(recipientId);
        if (recipientSocket) {
          io.to(recipientSocket.socketId).emit('receive_message', populatedMessage);
        }
        // Also send to sender
        socket.emit('receive_message', populatedMessage);
      }
    } catch (error) {
      socket.emit('error', 'Failed to send message');
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { roomId, recipientId, messageType } = data;
    
    if (messageType === 'room') {
      socket.to(roomId).emit('user_typing', { username: socket.username, roomId });
    } else if (recipientId) {
      const recipientSocket = onlineUsers.get(recipientId);
      if (recipientSocket) {
        io.to(recipientSocket.socketId).emit('user_typing', { 
          username: socket.username, 
          senderId: socket.userId 
        });
      }
    }
  });

  socket.on('typing_stop', (data) => {
    const { roomId, recipientId, messageType } = data;
    
    if (messageType === 'room') {
      socket.to(roomId).emit('user_stop_typing', { username: socket.username, roomId });
    } else if (recipientId) {
      const recipientSocket = onlineUsers.get(recipientId);
      if (recipientSocket) {
        io.to(recipientSocket.socketId).emit('user_stop_typing', { 
          username: socket.username, 
          senderId: socket.userId 
        });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User ${socket.username} disconnected`);
    
    // Mark user as offline
    await User.findByIdAndUpdate(socket.userId, { 
      isOnline: false, 
      lastSeen: new Date() 
    });
    
    onlineUsers.delete(socket.userId);
    
    // Broadcast updated user list
    io.emit('users_updated', Array.from(onlineUsers.values()).map(user => ({
      username: user.username,
      isOnline: true
    })));
  });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
    });
    
    await user.save();
    
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Room Routes
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user.userId })
      .populate('createdBy', 'username')
      .populate('members', 'username avatar isOnline');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const room = new Room({
      name,
      description,
      createdBy: req.user.userId,
      members: [req.user.userId]
    });
    
    await room.save();
    const populatedRoom = await Room.findById(room._id)
      .populate('createdBy', 'username')
      .populate('members', 'username avatar isOnline');
    
    res.status(201).json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Messages Routes
app.get('/api/messages/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ room: roomId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/messages/private/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await Message.find({
      messageType: 'private',
      $or: [
        { sender: req.user.userId, recipient: userId },
        { sender: userId, recipient: req.user.userId }
      ]
    })
      .populate('sender', 'username avatar')
      .populate('recipient', 'username')
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Users Routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.userId } })
      .select('username avatar isOnline lastSeen')
      .sort({ username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});