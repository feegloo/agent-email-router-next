import http from 'node:http';

const clients = new Set();
let pending = '';
let offset = 0;
let active = 0;
const tail = [];
const { open } = await import('node:fs/promises');

// This is the actual Ollama stdout/stderr file shared by the sidecar.
setInterval(async () => {
  let file;
  try {
    file = await open('/var/log/ollama/server.log', 'r');
    const { size } = await file.stat();
    if (size < offset) { offset = 0; pending = ''; }
    const buffer = Buffer.alloc(Math.min(size - offset, 65536));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
    offset += bytesRead;
    pending += buffer.subarray(0, bytesRead).toString('utf8');
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) {
      tail.push(line); if (tail.length > 6) tail.shift();
      for (const client of clients) client.write(`event: log\ndata: ${JSON.stringify({ line })}\n\n`);
    }
  } catch { /* Ollama may still be starting. */ }
  finally { await file?.close(); }
}, 250).unref();

http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (req.url === '/logs' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' });
    clients.add(res);
    for (const line of tail) res.write(`event: log\ndata: ${JSON.stringify({ line })}\n\n`);
    // Bounded lifetime also handles abandoned browser sessions and proxy failures.
    const deadline = setTimeout(() => res.end(), 660000);
    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
    res.on('close', () => { clients.delete(res); clearTimeout(deadline); clearInterval(heartbeat); });
    return;
  }
  if (req.url === '/api/ps' && req.method === 'GET') {
    const probe = http.get('http://127.0.0.1:11434/api/ps', response => {
      res.writeHead(response.statusCode ?? 502, { 'Content-Type': 'application/json' });
      response.pipe(res);
    });
    probe.setTimeout(4000, () => probe.destroy(new Error('Status timeout')));
    probe.on('error', () => { if (!res.headersSent) res.writeHead(503); res.end(); });
    res.on('close', () => probe.destroy());
    return;
  }
  if (req.url !== '/api/chat' || req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  active++;
  const upstream = http.request({ hostname: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST', headers: { 'Content-Type': 'application/json' } }, response => {
    res.writeHead(response.statusCode ?? 502, { 'Content-Type': 'application/json' });
    response.pipe(res);
  });
  upstream.setTimeout(600000, () => upstream.destroy(new Error('Ollama timeout')));
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('{"error":"Ollama unavailable"}'); });
  res.on('close', () => {
    upstream.destroy(); active--;
    if (active === 0) for (const client of clients) client.end();
  });
  req.pipe(upstream);
}).listen(Number(process.env.PORT ?? 8080), '0.0.0.0');
