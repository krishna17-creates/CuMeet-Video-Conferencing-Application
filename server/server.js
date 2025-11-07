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

// --- NEW: Define allowed origins in one place ---
const rawAllowedOrigins = [
  'http://localhost:5173', // local dev
  process.env.FRONTEND_URL // production frontend (from env)
].filter(Boolean);

// Normalize allowed origins (remove trailing slashes)
const allowedOrigins = rawAllowedOrigins.map(o => o.replace(/\/+$/,'').toLowerCase());

// CORS options: use a function to validate origin so we can normalize incoming origin
const corsOptions = {
  origin: (origin, callback) => {
    // Log incoming origin for easier debugging in Render logs
    // Note: origin will be undefined for same-origin requests or some server-to-server calls
    console.log('[CORS] Incoming origin:', origin);

    if (!origin) {
      // Allow non-browser or same-origin requests (no origin header)
      return callback(null, true);
    }

    const normalized = origin.replace(/\/+$/,'').toLowerCase();
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }

    console.warn('[CORS] Rejected origin:', origin, 'Normalized:', normalized, 'Allowed list:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // allow cookies/credentials if needed
};

// --- UPDATED: Use specific CORS for Socket.IO ---
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      // socket.io passes origin similarly; reuse logic
      const normalized = (origin || '').replace(/\/+$/,'').toLowerCase();
      if (!origin || allowedOrigins.includes(normalized)) return callback(null, true);
      console.warn('[Socket.IO CORS] Rejected origin:', origin);
      return callback('Not allowed by CORS');
    },
    methods: ['GET','POST'],
    credentials: true
  }
});

// --- Middleware ---

// --- UPDATED: Use specific CORS for Express (HTTP) routes ---
// This makes your API routes as secure as your socket routes
app.use(cors(corsOptions)); 
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