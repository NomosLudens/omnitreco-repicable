import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { testDb } from './db.js';
import {
  handleBootstrap,
  handleBootstrapStatus,
  handleLogin,
  handleLogout,
  handleMe,
  requireAuth,
  rateLimitMiddleware
} from './auth.js';
import {
  handleRegisterDevice,
  handleListDevices,
  handleUpdateDevice,
  handleRevokeDevice,
  handleCreateDeviceRequest,
  handleAcceptDeviceRequest,
  handleDeclineDeviceRequest
} from './devices.js';
import { setupPresenceWS } from './presence.js';

const app = express();
const PORT = process.env.PORT || 5188;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://omnitreco.nomosludens.ia.br';

// CORS restricted strictly to frontend origin with credentials
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === FRONTEND_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Omnitreco-Device-Id']
}));

app.use(express.json());
app.use(cookieParser());

// Health Check
app.get('/health', async (req, res) => {
  try {
    const dbOk = await testDb();
    res.json({
      status: 'ok',
      database: dbOk ? 'ok' : 'error',
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'error', error: err.message });
  }
});

// Auth Endpoints
app.get('/auth/bootstrap-status', handleBootstrapStatus);
app.post('/auth/bootstrap', rateLimitMiddleware(10, 60000), handleBootstrap);
app.post('/auth/login', rateLimitMiddleware(10, 60000), handleLogin);
app.post('/auth/logout', handleLogout);
app.get('/auth/me', requireAuth, handleMe);

// Device Management Endpoints
app.post('/devices/register', requireAuth, handleRegisterDevice);
app.get('/devices', requireAuth, handleListDevices);
app.patch('/devices/:id', requireAuth, handleUpdateDevice);
app.delete('/devices/:id', requireAuth, handleRevokeDevice);

// Device Requests Endpoints
app.post('/device-requests', requireAuth, handleCreateDeviceRequest);
app.post('/device-requests/:id/accept', requireAuth, handleAcceptDeviceRequest);
app.post('/device-requests/:id/decline', requireAuth, handleDeclineDeviceRequest);

const server = http.createServer(app);

// WebSocket Server for Device Presence
const wss = new WebSocketServer({ server, path: '/ws/device' });
setupPresenceWS(wss);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 OmniTreco Backend API executando na porta ${PORT} (local)`);
});
