import { afterEach, expect, it } from "vitest";
import http from "node:http";
import { fork } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const children = [];
const servers = [];
afterEach(async () => {
  for (const child of children.splice(0)) {
    child.kill();
    if (child.exitCode === null) await once(child, "exit");
  }
  for (const server of servers.splice(0)) await new Promise(resolve => server.close(resolve));
});

it("shares one model preload and waits before forwarding simultaneous chats", async () => {
  let releaseWarmup;
  const warmupBlocked = new Promise(resolve => { releaseWarmup = resolve; });
  let warmups = 0;
  let chats = 0;
  const upstream = http.createServer(async (req, res) => {
    if (req.url === "/api/generate") {
      warmups++;
      await warmupBlocked;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"done":true}');
      return;
    }
    if (req.url === "/api/chat") {
      chats++;
      let body = "";
      for await (const chunk of req) body += chunk;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: body }));
    }
  });
  servers.push(upstream);
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");

  const child = fork(fileURLToPath(new URL("./gateway.mjs", import.meta.url)), {
    env: { ...process.env, PORT: "0", OLLAMA_INTERNAL_URL: `http://127.0.0.1:${upstream.address().port}` },
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  children.push(child);
  const [{ port }] = await once(child, "message");
  const base = `http://127.0.0.1:${port}`;
  const warm = fetch(`${base}/warmup`, { method: "POST" });
  // The two user messages arrive before warmup has finished.
  const first = fetch(`${base}/api/chat`, { method: "POST", body: '{"user":"first"}' });
  const second = fetch(`${base}/api/chat`, { method: "POST", body: '{"user":"second"}' });

  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(warmups).toBe(1);
    expect(chats).toBe(0);
  } finally {
    releaseWarmup();
  }
  expect((await warm).status).toBe(200);
  const responses = await Promise.all([first, second]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect((await responses[0].json()).message).toBe('{"user":"first"}');
  expect((await responses[1].json()).message).toBe('{"user":"second"}');
  expect(chats).toBe(2);
  expect((await fetch(`${base}/warmup`, { method: "POST" })).status).toBe(200);
  expect(warmups).toBe(1);
}, 10000);
