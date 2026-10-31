const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_ROOM_SIZE = 8;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();
const clients = new Map();
const indexPath = path.join(__dirname, 'index.html');

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  if (request.method === 'GET' && pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  if (request.method !== 'GET' || (pathname !== '/' && pathname !== '/index.html')) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  fs.readFile(indexPath, (error, contents) => {
    if (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Could not read the ROAD FM page.');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(contents);
  });
});

const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  const origin = request.headers.origin;
  if (pathname !== '/sync' || (origin && new URL(origin).host !== request.headers.host)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, client => webSocketServer.emit('connection', client, request));
});

function send(client, message) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
}
function broadcast(room, message, except = null) {
  for (const member of room.members) if (member !== except) send(member, message);
}
function createRoomCode() {
  let code;
  do { code = Array.from({ length: 6 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function cleanState(input) {
  if (!input || typeof input !== 'object') return null;
  const playlistId = String(input.playlistId || '');
  if (!/^[\w-]{3,120}$/.test(playlistId)) return null;
  return {
    stationId: String(input.stationId || playlistId).slice(0, 80),
    stationName: String(input.stationName || 'Convoy station').slice(0, 36),
    playlistId,
    index: Math.max(0, Math.min(10000, Math.floor(Number(input.index) || 0))),
    currentTime: Math.max(0, Math.min(86400, Number(input.currentTime) || 0)),
    playing: input.playing === true,
    updatedAt: Date.now()
  };
}
function updateMembers(room) { broadcast(room, { type: 'room_update', members: room.members.size }); }
function leaveRoom(client, notifyClient = false) {
  const data = clients.get(client);
  if (!data || !data.roomCode) return;
  const code = data.roomCode;
  const room = rooms.get(code);
  data.roomCode = '';
  if (!room) return;
  room.members.delete(client);
  if (client === room.host) {
    broadcast(room, { type: 'room_closed', roomCode: code }, client);
    rooms.delete(code);
  } else updateMembers(room);
  if (notifyClient) send(client, { type: 'left_room' });
}

webSocketServer.on('connection', client => {
  clients.set(client, { id: randomUUID(), roomCode: '' });
  client.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch { send(client, { type: 'error', message: 'Invalid radio network message.' }); return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'create_room') {
      leaveRoom(client);
      const code = createRoomCode();
      const room = { code, host: client, members: new Set([client]), state: null, createdAt: Date.now() };
      rooms.set(code, room);
      clients.get(client).roomCode = code;
      send(client, { type: 'room_created', roomCode: code, members: 1 });
      return;
    }
    if (message.type === 'join_room') {
      leaveRoom(client);
      const code = String(message.roomCode || '').toUpperCase();
      const room = rooms.get(code);
      if (!room) { send(client, { type: 'error', message: 'Room not found. Check the code or ask the host to create a new room.' }); return; }
      if (room.members.size >= MAX_ROOM_SIZE) { send(client, { type: 'error', message: `Room is full (${MAX_ROOM_SIZE} drivers maximum).` }); return; }
      room.members.add(client);
      clients.get(client).roomCode = code;
      send(client, { type: 'room_joined', roomCode: code, members: room.members.size, state: room.state });
      updateMembers(room);
      return;
    }
    if (message.type === 'leave_room') { leaveRoom(client, true); return; }

    const data = clients.get(client);
    const room = data && rooms.get(data.roomCode);
    if (!room || client !== room.host) {
      if (['playback', 'station', 'command'].includes(message.type)) send(client, { type: 'error', message: 'Only the room host can change convoy playback.' });
      return;
    }
    if (message.type === 'station' || message.type === 'playback') {
      const state = cleanState(message.state);
      if (!state) { send(client, { type: 'error', message: 'Invalid playlist state.' }); return; }
      room.state = state;
      broadcast(room, { type: 'playback', state }, client);
    } else if (message.type === 'command' && ['play', 'pause', 'next', 'previous'].includes(message.action)) {
      broadcast(room, { type: 'command', action: message.action }, client);
    }
  });
  client.on('close', () => { leaveRoom(client); clients.delete(client); });
});

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.createdAt > 12 * 60 * 60 * 1000) rooms.delete(code);
}, 60 * 60 * 1000);
cleanupTimer.unref();

server.listen(PORT, HOST, () => console.log(`ROAD FM ready at http://localhost:${PORT}`));