import { hashToken, verifyWord } from './auth.js';
import { pool } from './db.js';
import parseCookie from 'cookie';

// In-memory maps
const deviceSockets = new Map(); // deviceId -> ws
const socketDevices = new Map(); // ws -> { deviceId, userId }

export function isDeviceOnline(deviceId) {
  const ws = deviceSockets.get(deviceId);
  return ws ? ws.readyState === 1 /* OPEN */ : false;
}

export function sendToDeviceWS(deviceId, data) {
  const ws = deviceSockets.get(deviceId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

export function registerPresence(deviceId, userId, ws) {
  // If device already connected on another socket, close old socket
  const oldWs = deviceSockets.get(deviceId);
  if (oldWs && oldWs !== ws) {
    try { oldWs.close(4000, 'Replaced by new connection'); } catch {}
  }

  deviceSockets.set(deviceId, ws);
  socketDevices.set(ws, { deviceId, userId });

  // Update DB last_seen_at
  pool.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [deviceId]).catch(() => {});
}

export function removePresence(ws) {
  const meta = socketDevices.get(ws);
  if (meta) {
    const { deviceId } = meta;
    if (deviceSockets.get(deviceId) === ws) {
      deviceSockets.delete(deviceId);
    }
    socketDevices.delete(ws);
  }
}

export function setupPresenceWS(wss) {
  // Ping/Pong Heartbeat Interval
  const interval = setInterval(() => {
    for (const [ws] of socketDevices) {
      if (ws.isAlive === false) {
        removePresence(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', async (ws, req) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Validate Origin header
    const origin = req.headers.origin;
    const allowedOrigin = process.env.FRONTEND_ORIGIN || 'https://omnitreco.nomosludens.ia.br';
    const allowLocalTests = process.env.OMNITRECO_ALLOW_LOCAL_TESTS === 'true';

    if (origin && origin !== allowedOrigin && !allowLocalTests) {
      ws.send(JSON.stringify({ type: 'error', message: 'Origem não permitida.' }));
      ws.close(4003, 'Forbidden');
      return;
    }

    // Authenticate WS connection via Cookie
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const deviceId = urlParams.get('deviceId');
    let token = null;

    if (req.headers.cookie) {
      const cookies = parseCookie.parse(req.headers.cookie);
      token = cookies.omnitreco_sid;
    }

    if (!token && allowLocalTests) {
      token = urlParams.get('token');
    }

    if (!token || !deviceId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Autenticação de sessão e deviceId são obrigatórios.' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    const tokenHashed = hashToken(token);

    try {
      const authQuery = `
        SELECT s.user_id, d.id as device_id
        FROM sessions s
        JOIN devices d ON d.user_id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now() AND d.id = $2 AND d.revoked_at IS NULL;
      `;
      const res = await pool.query(authQuery, [tokenHashed, deviceId]);

      if (res.rows.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'Sessão ou dispositivo inválido.' }));
        ws.close(4003, 'Forbidden');
        return;
      }

      const { user_id } = res.rows[0];
      registerPresence(deviceId, user_id, ws);

      ws.send(JSON.stringify({
        type: 'presence-connected',
        deviceId,
        status: 'online'
      }));

      ws.on('close', () => {
        removePresence(ws);
      });

      ws.on('error', () => {
        removePresence(ws);
      });

    } catch (err) {
      console.error('WS Presence auth error:', err);
      ws.close(5000, 'Internal Error');
    }
  });
}
