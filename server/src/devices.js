import { pool } from './db.js';
import { isDeviceOnline, sendToDeviceWS } from './presence.js';

export async function getCallingDevice(req) {
  const callingDeviceId = req.headers['x-omnitreco-device-id'];
  if (!callingDeviceId) return null;

  const query = `
    SELECT id, display_name, device_type
    FROM devices
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;
  `;
  const result = await pool.query(query, [callingDeviceId, req.user.id]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export async function handleRegisterDevice(req, res) {
  const { installationId, displayName, deviceType } = req.body || {};

  if (!installationId || !displayName) {
    return res.status(400).json({ error: 'installationId e displayName são obrigatórios.' });
  }

  const userId = req.user.id;
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    const query = `
      INSERT INTO devices (user_id, installation_id, display_name, device_type, user_agent, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (user_id, installation_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        device_type = EXCLUDED.device_type,
        user_agent = EXCLUDED.user_agent,
        last_seen_at = now(),
        revoked_at = NULL
      RETURNING id, installation_id, display_name, device_type, created_at, last_seen_at;
    `;

    const result = await pool.query(query, [userId, installationId, displayName.trim(), deviceType || 'Unknown', userAgent]);
    const device = result.rows[0];

    res.json({
      status: 'ok',
      device: {
        ...device,
        online: isDeviceOnline(device.id)
      }
    });
  } catch (err) {
    console.error('Register device error:', err);
    res.status(500).json({ error: 'Erro ao registrar dispositivo.' });
  }
}

export async function handleListDevices(req, res) {
  const userId = req.user.id;

  try {
    const query = `
      SELECT id, installation_id, display_name, device_type, created_at, last_seen_at, revoked_at
      FROM devices
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY last_seen_at DESC;
    `;
    const result = await pool.query(query, [userId]);

    const devices = result.rows.map(d => ({
      ...d,
      online: isDeviceOnline(d.id)
    }));

    res.json({ status: 'ok', devices });
  } catch (err) {
    console.error('List devices error:', err);
    res.status(500).json({ error: 'Erro ao listar dispositivos.' });
  }
}

export async function handleUpdateDevice(req, res) {
  const { id } = req.params;
  const { displayName } = req.body || {};
  const userId = req.user.id;

  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'Novo nome é obrigatório.' });
  }

  try {
    const query = `
      UPDATE devices
      SET display_name = $1, last_seen_at = now()
      WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
      RETURNING id, installation_id, display_name, device_type, created_at, last_seen_at;
    `;
    const result = await pool.query(query, [displayName.trim(), id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado ou não pertence a esta conta.' });
    }

    res.json({ status: 'ok', device: result.rows[0] });
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Erro ao atualizar dispositivo.' });
  }
}

export async function handleRevokeDevice(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const query = `
      UPDATE devices
      SET revoked_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado ou não pertence a esta conta.' });
    }

    res.json({ status: 'ok', message: 'Dispositivo revogado com sucesso.' });
  } catch (err) {
    console.error('Revoke device error:', err);
    res.status(500).json({ error: 'Erro ao revogar dispositivo.' });
  }
}

// Device Requests Logic
export async function handleCreateDeviceRequest(req, res) {
  const { fromDeviceId, toDeviceId, action, roomId, fileName, totalBytes, mimeType } = req.body || {};
  const userId = req.user.id;

  const callingDevice = await getCallingDevice(req);
  if (!callingDevice) {
    return res.status(403).json({ error: 'Header X-Omnitreco-Device-Id ausente, inválido ou revogado.' });
  }

  if (!fromDeviceId || !toDeviceId || !action || !roomId) {
    return res.status(400).json({ error: 'fromDeviceId, toDeviceId, action e roomId são obrigatórios.' });
  }

  if (fromDeviceId !== callingDevice.id) {
    return res.status(403).json({ error: 'fromDeviceId deve corresponder ao dispositivo solicitante.' });
  }

  if (fromDeviceId === toDeviceId) {
    return res.status(400).json({ error: 'fromDeviceId e toDeviceId não podem ser iguais.' });
  }

  const allowedActions = ['file-transfer', 'macgyver-camera'];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({ error: 'Action inválida.' });
  }

  // Validate room ID format: word-XXXX-XXXX-XXXX-XXXX
  const roomRegex = /^[a-z]+-[0-9a-hjkmnp-tv-z]{4}(?:-[0-9a-hjkmnp-tv-z]{4}){3}$/i;
  if (!roomRegex.test(roomId)) {
    return res.status(400).json({ error: 'Formato de roomId inválido.' });
  }

  try {
    // Check target device belongs to user
    const devQuery = `
      SELECT id, display_name, device_type FROM devices
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;
    `;
    const devRes = await pool.query(devQuery, [toDeviceId, userId]);

    if (devRes.rows.length === 0) {
      return res.status(403).json({ error: 'Dispositivo de destino não pertence a você ou foi revogado.' });
    }

    if (!isDeviceOnline(toDeviceId)) {
      return res.status(400).json({ error: 'O dispositivo de destino não está online.' });
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const insertQuery = `
      INSERT INTO device_requests (user_id, from_device_id, to_device_id, action, room_id, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING id, from_device_id, to_device_id, action, room_id, status, created_at, expires_at;
    `;

    const reqRes = await pool.query(insertQuery, [userId, fromDeviceId, toDeviceId, action, roomId, expiresAt]);
    const deviceReq = reqRes.rows[0];

    const fileMeta = (action === 'file-transfer' && fileName) ? {
      fileName: String(fileName).slice(0, 255),
      totalBytes: typeof totalBytes === 'number' ? totalBytes : 0,
      mimeType: mimeType ? String(mimeType).slice(0, 100) : 'application/octet-stream'
    } : null;

    // Emit WS notification to target device
    const sent = sendToDeviceWS(toDeviceId, {
      type: 'device-request',
      request: {
        id: deviceReq.id,
        fromDevice: { id: callingDevice.id, display_name: callingDevice.display_name, device_type: callingDevice.device_type },
        action,
        roomId,
        fileMeta,
        createdAt: deviceReq.created_at
      }
    });

    if (!sent) {
      return res.status(400).json({ error: 'Falha ao notificar dispositivo via WebSocket.' });
    }

    res.json({ status: 'ok', request: deviceReq });
  } catch (err) {
    console.error('Create device request error:', err);
    res.status(500).json({ error: 'Erro ao criar solicitação.' });
  }
}

export async function handleAcceptDeviceRequest(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const callingDevice = await getCallingDevice(req);
  if (!callingDevice) {
    return res.status(403).json({ error: 'Header X-Omnitreco-Device-Id ausente, inválido ou revogado.' });
  }

  try {
    const checkQuery = `
      SELECT id, from_device_id, to_device_id, action, room_id, status
      FROM device_requests
      WHERE id = $1 AND user_id = $2 AND status = 'pending' AND expires_at > now();
    `;
    const checkRes = await pool.query(checkQuery, [id, userId]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação não encontrada, expirada ou já respondida.' });
    }

    const deviceReq = checkRes.rows[0];

    // Require target device to be the caller
    if (deviceReq.to_device_id !== callingDevice.id) {
      return res.status(403).json({ error: 'Apenas o dispositivo de destino pode aceitar a solicitação.' });
    }

    await pool.query("UPDATE device_requests SET status = 'accepted' WHERE id = $1", [id]);
    deviceReq.status = 'accepted';

    // Notify initiator via WS
    sendToDeviceWS(deviceReq.from_device_id, {
      type: 'device-request-accepted',
      requestId: deviceReq.id,
      roomId: deviceReq.room_id
    });

    res.json({ status: 'ok', request: deviceReq });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ error: 'Erro ao aceitar solicitação.' });
  }
}

export async function handleDeclineDeviceRequest(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const callingDevice = await getCallingDevice(req);
  if (!callingDevice) {
    return res.status(403).json({ error: 'Header X-Omnitreco-Device-Id ausente, inválido ou revogado.' });
  }

  try {
    const checkQuery = `
      SELECT id, from_device_id, to_device_id, action, room_id, status
      FROM device_requests
      WHERE id = $1 AND user_id = $2 AND status = 'pending';
    `;
    const checkRes = await pool.query(checkQuery, [id, userId]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitação não encontrada ou já encerrada.' });
    }

    const deviceReq = checkRes.rows[0];

    if (deviceReq.to_device_id !== callingDevice.id) {
      return res.status(403).json({ error: 'Apenas o dispositivo de destino pode recusar a solicitação.' });
    }

    await pool.query("UPDATE device_requests SET status = 'declined' WHERE id = $1", [id]);
    deviceReq.status = 'declined';

    // Notify initiator via WS
    sendToDeviceWS(deviceReq.from_device_id, {
      type: 'device-request-declined',
      requestId: deviceReq.id
    });

    res.json({ status: 'ok', request: deviceReq });
  } catch (err) {
    console.error('Decline request error:', err);
    res.status(500).json({ error: 'Erro ao recusar solicitação.' });
  }
}
