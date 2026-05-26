const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, './.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sanitizeInput } = require('./middleware/requestValidator');
const { createLogger } = require('./utils/logger');
const { rateLimiter } = require('./utils/security');
const { RATE_LIMIT } = require('./config/constants');

const logger = createLogger('Server');
const app = express();
const server = http.createServer(app);

const rawAllowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

const allowedOrigins = rawAllowedOrigins.map((origin) =>
  origin.replace(/\/+$/, '').toLowerCase()
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/+$/, '').toLowerCase();
    if (allowedOrigins.includes(normalized)) return callback(null, true);

    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  credentials: true,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(sanitizeInput);
app.use(rateLimiter(RATE_LIMIT.API_REQUESTS.windowMs, RATE_LIMIT.API_REQUESTS.maxRequests));

app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      duration: Date.now() - startTime,
      ip: req.ip,
    });
  });
  next();
});

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected successfully.');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!' });
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
