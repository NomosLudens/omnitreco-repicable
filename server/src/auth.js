import crypto from 'crypto';
import { pool } from './db.js';

// Rate Limiting Map (in-memory per IP)
const rateLimitMap = new Map();

export function rateLimitMiddleware(maxAttempts = 10, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
    } else {
      record.count++;
    }

    rateLimitMap.set(ip, record);

    if (record.count > maxAttempts) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    }

    next();
  };
}

export async function handleBootstrapStatus(req, res) {
  try {
    const countRes = await pool.query('SELECT COUNT(*)::int as count FROM users');
    const userCount = countRes.rows[0].count;
    res.json({ status: 'ok', initialized: userCount > 0 });
  } catch (err) {
    console.error('Bootstrap status error:', err);
    res.status(500).json({ error: 'Erro ao checar status de inicialização.' });
  }
}

// Password Hashing via Scrypt
export function hashWord(word) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(word, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyWord(word, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash || !storedHash.includes(':')) return resolve(false);
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    crypto.scrypt(word, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Auth Middleware
export async function requireAuth(req, res, next) {
  let token = req.cookies ? req.cookies.omnitreco_sid : null;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const tokenHashed = hashToken(token);

  try {
    const query = `
      SELECT s.id as session_id, s.expires_at, u.id as user_id, u.name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `;
    const result = await pool.query(query, [tokenHashed]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }

    const row = result.rows[0];
    req.user = { id: row.user_id, name: row.name };
    req.session = { id: row.session_id, token };

    // Update last_seen_at asynchronously
    pool.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]).catch(() => {});

    next();
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'Erro de autenticação' });
  }
}

// Handler Functions
export async function handleBootstrap(req, res) {
  const { name, word } = req.body || {};

  if (!name || !word || typeof name !== 'string' || typeof word !== 'string') {
    return res.status(400).json({ error: 'Nome e Palavra são obrigatórios.' });
  }

  const cleanName = name.trim().toLowerCase();
  const cleanWord = word.trim();

  if (cleanName.length < 2 || cleanWord.length < 4) {
    return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres e a Palavra pelo menos 4.' });
  }

  try {
    const countRes = await pool.query('SELECT COUNT(*)::int as count FROM users');
    const userCount = countRes.rows[0].count;

    const allowSignup = process.env.OMNITRECO_ALLOW_SIGNUP === 'true';

    if (userCount > 0 && !allowSignup) {
      return res.status(403).json({ error: 'Registro de novos usuários desativado.' });
    }

    const wordHashed = await hashWord(cleanWord);
    const insertRes = await pool.query(
      'INSERT INTO users (name, word_hash) VALUES ($1, $2) RETURNING id, name, created_at',
      [cleanName, wordHashed]
    );

    const newUser = insertRes.rows[0];

    // Create initial session
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHashed = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [newUser.id, tokenHashed, expiresAt]
    );

    res.cookie('omnitreco_sid', rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      status: 'ok',
      user: { id: newUser.id, name: newUser.name }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Este nome já está em uso.' });
    }
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Erro ao criar conta.' });
  }
}

export async function handleLogin(req, res) {
  const { name, word } = req.body || {};

  if (!name || !word) {
    return res.status(400).json({ error: 'Nome e Palavra são obrigatórios.' });
  }

  const cleanName = name.trim().toLowerCase();
  const cleanWord = word.trim();

  try {
    const userRes = await pool.query('SELECT id, name, word_hash FROM users WHERE name = $1', [cleanName]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Nome ou Palavra incorretos.' });
    }

    const user = userRes.rows[0];
    const match = await verifyWord(cleanWord, user.word_hash);

    if (!match) {
      return res.status(401).json({ error: 'Nome ou Palavra incorretos.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHashed = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHashed, expiresAt]
    );

    res.cookie('omnitreco_sid', rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      status: 'ok',
      user: { id: user.id, name: user.name }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro ao realizar login.' });
  }
}

export async function handleLogout(req, res) {
  const token = req.session ? req.session.token : (req.cookies ? req.cookies.omnitreco_sid : null);
  if (token) {
    const tokenHashed = hashToken(token);
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHashed]).catch(() => {});
  }

  res.clearCookie('omnitreco_sid', { path: '/' });
  res.json({ status: 'ok', message: 'Sessão encerrada.' });
}

export async function handleMe(req, res) {
  res.json({
    status: 'ok',
    user: req.user
  });
}
