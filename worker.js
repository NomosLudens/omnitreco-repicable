/**
 * OmniTreco — Cloudflare Worker: WebRTC Signaling with Durable Objects
 *
 * Architecture:
 * - Each P2P room is a Durable Object instance identified by roomId
 * - Peers connect via WebSocket to /api/room/:roomId/ws
 * - The Durable Object relays offer/answer/candidate messages between exactly 2 peers
 * - No file content is ever stored or relayed through HTTP body persistence
 * - Room state is ephemeral: vanishes when both peers disconnect
 *
 * Messages (JSON over WebSocket):
 *   { type: 'join' }
 *   { type: 'offer', sdp: '...' }
 *   { type: 'answer', sdp: '...' }
 *   { type: 'candidate', candidate: {...} }
 *   { type: 'peer-ready' }  -- sent by server when 2nd peer joins
 *   { type: 'peer-left' }   -- sent by server when peer disconnects
 *   { type: 'error', message: '...' }
 */

export { SignalingRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Security Guard: Block access to hidden/system/config files (.git, .wrangler, worker.js, wrangler.jsonc)
    if (url.pathname.startsWith('/.') || url.pathname.includes('/.') || url.pathname === '/worker.js' || url.pathname === '/wrangler.jsonc') {
      return new Response('Access Denied', { status: 403, headers: corsHeaders() });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

    // WebSocket upgrade for signaling: /api/room/:roomId/ws
    const wsMatch = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9_-]{4,64})\/ws$/);
    if (wsMatch) {
      // Sanitize roomId: only allow safe characters
      const roomId = wsMatch[1].replace(/[^a-zA-Z0-9_-]/g, '');
      if (!roomId) {
        return new Response('Invalid room ID', { status: 400 });
      }

      // Route to the Durable Object for this room
      const id = env.SIGNALING_ROOM.idFromName(roomId);
      const stub = env.SIGNALING_ROOM.get(id);
      return stub.fetch(request);
    }

    // Proxy to OmniTreco Backend API on VM max
    if (url.pathname.startsWith('/api/identity/')) {
      const targetPath = url.pathname.replace(/^\/api\/identity/, '');
      const backendBase = env.IDENTITY_BACKEND_URL;

      if (!backendBase) {
        return new Response(JSON.stringify({ error: 'Backend proxy target missing from environment' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
      }

      const backendUrl = `${backendBase.replace(/\/$/, '')}${targetPath}${url.search}`;
      
      const reqHeaders = new Headers(request.headers);
      reqHeaders.set('X-Forwarded-Host', url.host);

      try {
        const backendRes = await fetch(backendUrl, {
          method: request.method,
          headers: reqHeaders,
          body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
          redirect: 'manual'
        });
        return backendRes;
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Backend API temporariamente indisponível' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders() }
        });
      }
    }

    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    // Serve static frontend assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('OmniTreco — Signaling Ready', {
      headers: { 'Content-Type': 'text/plain', ...corsHeaders() }
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection'
  };
}

/**
 * Durable Object: SignalingRoom
 * OmniTreco — Cloudflare Worker: WebRTC Signaling with Durable Objects
 */
class SignalingRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {WebSocket[]} */
    this.peers = [];
  }

  async fetch(request) {
    // Must be a WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    // Enforce max 2 peers
    if (this.peers.length >= 2) {
      // Reject with WebSocket close - but we need to upgrade first
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      server.send(JSON.stringify({ type: 'error', message: 'Room is full (max 2 peers).' }));
      server.close(4001, 'Room full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    const peerIndex = this.peers.length;
    this.peers.push(server);

    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data);
    });

    server.addEventListener('close', () => {
      this.peers = this.peers.filter(p => p !== server);
      // Notify the remaining peer
      this.broadcast(server, JSON.stringify({ type: 'peer-left' }));
    });

    server.addEventListener('error', () => {
      this.peers = this.peers.filter(p => p !== server);
    });

    // If this is the 2nd peer, notify both that the room is ready
    if (this.peers.length === 2) {
      // Tell both peers they are connected
      this.peers.forEach((peer, idx) => {
        peer.send(JSON.stringify({
          type: 'peer-ready',
          role: idx === 0 ? 'host' : 'remote',
          peerCount: 2
        }));
      });
    } else {
      // First peer: waiting for the second
      server.send(JSON.stringify({
        type: 'waiting',
        role: 'host',
        message: 'Aguardando o outro dispositivo escanear o QR...'
      }));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  handleMessage(sender, rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch {
      sender.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    // Allowed signaling message types only — never relay binary/file data
    const allowedTypes = ['offer', 'answer', 'candidate', 'join', 'peer-ready'];
    if (!allowedTypes.includes(msg.type)) {
      sender.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
      return;
    }

    // Relay to the other peer
    this.broadcast(sender, rawData);
  }

  /** Send a message to all peers EXCEPT the sender. */
  broadcast(sender, data) {
    for (const peer of this.peers) {
      if (peer !== sender && peer.readyState === 1 /* OPEN */) {
        peer.send(data);
      }
    }
  }
}
