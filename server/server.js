// --- CRITICAL: Load environment variables from .env file FIRST ---
// This ensures that all other modules see the environment variables when they are imported.
const dotenv = require('dotenv');
const path = require('path');
const _envResult = dotenv.config({ path: path.resolve(__dirname, './.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mediasoup = require('mediasoup');

// NOTE: route imports are loaded after dotenv configuration below so that
// route modules see process.env values when they execute at module load time.
// (We import them later, below the dotenv.config() section.)

// _envResult = { parsed, error }
console.log('[Env] process.cwd() =', process.cwd());
if (_envResult.error) {
  console.warn('[Env] dotenv.config() error:', _envResult.error.message);
} else {
  const parsedKeys = Object.keys(_envResult.parsed || {});
  console.log('[Env] dotenv loaded, keys count =', parsedKeys.length);
  // --- FIX: Add MONGO_URI to the environment variable check ---
  console.log('[Env] .env parsed contains MONGO_URI=', parsedKeys.includes('MONGO_URI'), 'SENDGRID_API_KEY=', parsedKeys.includes('SENDGRID_API_KEY'));
}
// Also show current runtime process.env presence for the same keys (may come from host env)
console.log('[Env] process.env presence - MONGO_URI=', !!process.env.MONGO_URI, 'SENDGRID_API_KEY=', !!process.env.SENDGRID_API_KEY);


// Import routes after dotenv has loaded so they see env vars during module load
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const socketHandler = require('./middleware/socketHandler');

const app = express();

// --- CRITICAL: Add a global request logger at the VERY TOP ---
// This will run for EVERY request, before CORS or anything else.
app.use((req, res, next) => {
  try {
    console.log(`[SERVER] Request Received: ${req.method} ${req.originalUrl}`);
  } catch (e) {
    // ignore logging errors
  }
  next();
});
const server = http.createServer(app);

// Global request logger to capture every incoming HTTP request (dev use)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    try {
      console.log(`[HTTP] ${new Date().toISOString()} ${req.method} ${req.originalUrl} - headers: ${Object.keys(req.headers).slice(0,6).join(',')}`);
    } catch (e) {
      // ignore logging errors
    }
    next();
  });
}

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
  console.log('Attempting to connect to MongoDB...');
  try {
    // --- FIX: Use MONGO_URI which matches your .env file ---
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Keep this for faster connection timeouts
    });
    console.log('✅ MongoDB Connected Successfully.');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    // It's critical to exit if the DB connection fails, otherwise the app will hang.
    console.error('The application will now exit. Please check your MONGO_URI environment variable and database status.');
    process.exit(1);
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