import { afterEach, describe, expect, test } from "bun:test";

import type { AppConfig } from "../src_old/config.js";
import type { ServerEvent } from "../src_old/protocol.js";
import { startServer, type NexiPalsServer } from "../src_old/server.js";

const ORIGIN = "http://localhost:5173";
const SECRET = "server-test-secret-that-is-long-enough-to-use";
const TEST_PORT = 30_000 + Math.floor(Math.random() * 10_000);

const config: AppConfig = {
  host: "127.0.0.1",
  port: TEST_PORT,
  cookieSecret: SECRET,
  allowedOrigins: [ORIGIN],
  maxMessageLength: 280,
  maxFrameBytes: 16_384,
};

const runningServers: NexiPalsServer[] = [];

afterEach(async () => {
  await Promise.all(
    runningServers.splice(0).map(({ server }) => server.stop(true)),
  );
});

async function createSession(
  server: NexiPalsServer,
): Promise<{ cookie: string; userId: string }> {
  const response = await fetch(`${server.server.url}api/session`, {
    headers: { Origin: ORIGIN },
  });
  expect(response.status).toBe(200);

  const body = (await response.json()) as { userId: string };
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).not.toBeNull();

  return { cookie: setCookie?.split(";", 1)[0] ?? "", userId: body.userId };
}

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("WebSocket failed to open")),
      { once: true },
    );
  });
}

class SocketInbox {
  private readonly events: ServerEvent[] = [];
  private readonly waiters: Array<(event: ServerEvent) => void> = [];

  public constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const parsed = JSON.parse(String(event.data)) as ServerEvent;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(parsed);
      } else {
        this.events.push(parsed);
      }
    });
  }

  public next(): Promise<ServerEvent> {
    const event = this.events.shift();
    if (event) {
      return Promise.resolve(event);
    }

    return new Promise((resolve) => this.waiters.push(resolve));
  }

  public get websocket(): WebSocket {
    return this.socket;
  }
}

function connectWithHeaders(url: string, cookie: string): SocketInbox {
  const WebSocketWithOptions = WebSocket as unknown as new (
    url: string,
    options: Bun.WebSocketOptions,
  ) => WebSocket;
  const socket = new WebSocketWithOptions(url, {
    headers: { Cookie: cookie, Origin: ORIGIN },
  });
  return new SocketInbox(socket);
}

function waitForClose(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    socket.addEventListener("close", () => resolve(), { once: true });
    socket.close();
  });
}

describe("HTTP and WebSocket server", () => {
  test("creates sessions, tracks presence, broadcasts messages, and never replays them", async () => {
    const application = startServer(config);
    runningServers.push(application);

    const firstSession = await createSession(application);
    const secondSession = await createSession(application);
    expect(firstSession.userId).not.toBe(secondSession.userId);

    const websocketUrl = `${application.server.url}ws`;
    const firstSocket = connectWithHeaders(websocketUrl, firstSession.cookie);
    await waitForOpen(firstSocket.websocket);
    expect(await firstSocket.next()).toEqual({
      type: "session.ready",
      userId: firstSession.userId,
    });
    expect(await firstSocket.next()).toEqual({
      type: "presence.snapshot",
      userIds: [firstSession.userId],
    });

    const secondSocket = connectWithHeaders(websocketUrl, secondSession.cookie);
    await waitForOpen(secondSocket.websocket);
    expect(await secondSocket.next()).toEqual({
      type: "session.ready",
      userId: secondSession.userId,
    });
    expect(await secondSocket.next()).toEqual({
      type: "presence.snapshot",
      userIds: [firstSession.userId, secondSession.userId],
    });
    expect(await firstSocket.next()).toEqual({
      type: "presence.joined",
      userId: secondSession.userId,
    });

    firstSocket.websocket.send(
      JSON.stringify({ type: "chat.send", text: "Hello 🐻" }),
    );
    const firstMessage = await firstSocket.next();
    const secondMessage = await secondSocket.next();
    expect(firstMessage).toMatchObject({
      type: "chat.message",
      userId: firstSession.userId,
      text: "Hello 🐻",
    });
    expect(secondMessage).toEqual(firstMessage);

    await waitForClose(firstSocket.websocket);
    expect(await secondSocket.next()).toEqual({
      type: "presence.left",
      userId: firstSession.userId,
    });

    await waitForClose(secondSocket.websocket);
    const reconnectedSocket = connectWithHeaders(
      websocketUrl,
      secondSession.cookie,
    );
    await waitForOpen(reconnectedSocket.websocket);
    expect(await reconnectedSocket.next()).toEqual({
      type: "session.ready",
      userId: secondSession.userId,
    });
    expect(await reconnectedSocket.next()).toEqual({
      type: "presence.snapshot",
      userIds: [secondSession.userId],
    });
    await waitForClose(reconnectedSocket.websocket);
  });

  test("rejects sessions and upgrades from disallowed origins", async () => {
    const application = startServer(config);
    runningServers.push(application);

    const sessionResponse = await fetch(
      `${application.server.url}api/session`,
      {
        headers: { Origin: "https://outside.example" },
      },
    );
    expect(sessionResponse.status).toBe(403);

    const websocketResponse = await fetch(`${application.server.url}ws`, {
      headers: { Origin: ORIGIN },
    });
    expect(websocketResponse.status).toBe(401);
  });
});
