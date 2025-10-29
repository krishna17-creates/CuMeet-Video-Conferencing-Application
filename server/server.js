const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');

// Import routes
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const socketHandler = require('./middleware/socketHandler');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cumeet', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Running without database - some features may not work');
    console.log('💡 To fix this:');
    console.log('   1. Install MongoDB locally: https://docs.mongodb.com/manual/installation/');
    console.log('   2. Start MongoDB service: mongod');
    console.log('   3. Or use MongoDB Atlas cloud database');
  }
};

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

// --- Mediasoup Worker ---
let worker;
const createWorker = async () => {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'warn'
    });
    console.log(`✅ Mediasoup worker started with pid ${worker.pid}`);
    worker.on('died', () => {
      console.error('❌ Mediasoup worker has died');
      setTimeout(() => process.exit(1), 2000); // exit in 2 seconds
    });
    return worker;
  } catch (error) {
    console.error('❌ Mediasoup worker failed to start:', error);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 5000;

(async () => {
  worker = await createWorker();
  // Initialize Socket.IO logic and pass the worker
  socketHandler(io, worker);

  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
})();