import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoomStore } from './src/rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const srcDir = path.join(__dirname, 'src');
const store = createRoomStore();
const subscribers = new Map();
const env = typeof process === 'undefined' ? {} : process.env;
const port = Number(env.PORT || 3000);
const host = env.HOST || '0.0.0.0';

export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'POST' && url.pathname === '/api/rooms') return json(res, createAndBroadcast(await readJson(req)));
    if (req.method === 'POST' && url.pathname.match(/^\/api\/rooms\/[^/]+\/join$/)) return json(res, joinAndBroadcast(url, await readJson(req)));
    if (req.method === 'POST' && url.pathname.match(/^\/api\/rooms\/[^/]+\/move$/)) return json(res, moveAndBroadcast(url, await readJson(req)));
    if (req.method === 'POST' && url.pathname.match(/^\/api\/rooms\/[^/]+\/rematch$/)) return json(res, rematchAndBroadcast(url, await readJson(req)));
    if (req.method === 'GET' && url.pathname.match(/^\/api\/rooms\/[^/]+\/events$/)) return subscribe(url, res);
    return serveStatic(url, res);
  } catch (error) {
    json(res, { error: error.message }, 400);
  }
});

if (env.OMOK_NO_LISTEN !== '1' && globalThis.__OMOK_NO_LISTEN !== true) {
  server.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`Omok server running at http://${displayHost}:${port}`);
  });
}

function createAndBroadcast(body) {
  const result = store.createRoom({ nickname: body.nickname, partyMode: Boolean(body.partyMode) });
  broadcast(result.room.code);
  return result;
}

function joinAndBroadcast(url, body) {
  const code = roomCodeFrom(url);
  const result = store.joinRoom({ code, nickname: body.nickname });
  broadcast(code);
  return result;
}

function moveAndBroadcast(url, body) {
  const code = roomCodeFrom(url);
  const result = store.placeStone({ code, playerId: body.playerId, row: body.row, col: body.col });
  broadcast(code);
  return result;
}

function rematchAndBroadcast(url, body) {
  const code = roomCodeFrom(url);
  const result = store.requestRematch({ code, playerId: body.playerId });
  broadcast(code);
  return result;
}

function roomCodeFrom(url) {
  return url.pathname.split('/')[3].toUpperCase();
}

function subscribe(url, res) {
  const code = roomCodeFrom(url);
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(store.getRoom(code))}\n\n`);
  const set = subscribers.get(code) ?? new Set();
  set.add(res);
  subscribers.set(code, set);
  res.on('close', () => set.delete(res));
}

function broadcast(code) {
  if (!subscribers.has(code)) return;
  const payload = `data: ${JSON.stringify(store.getRoom(code))}\n\n`;
  for (const res of subscribers.get(code)) res.write(payload);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function json(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function serveStatic(url, res) {
  const root = url.pathname.startsWith('/src/') ? srcDir : publicDir;
  const requested = url.pathname === '/' ? '/index.html' : url.pathname.replace(/^\/src\//, '/');
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) return json(res, { error: 'not found' }, 404);
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'content-type': contentType(filePath) });
    res.end(data);
  } catch {
    json(res, { error: 'not found' }, 404);
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.webmanifest')) return 'application/manifest+json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}
