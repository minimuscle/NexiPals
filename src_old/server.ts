import { randomUUID } from "node:crypto";

import type { Server, ServerWebSocket } from "bun";

import type { AppConfig } from "./config.js";
import { createDeviceCookie, readDeviceId, serializeDeviceCookie } from "./identity.js";
import { PresenceRoom, type SocketData } from "./room.js";
import { errorEvent, parseClientMessage, ProtocolError, type ServerEvent } from "./protocol.js";

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function originAllowed(request: Request, config: AppConfig): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && config.allowedOrigins.includes(origin);
}

function sendEvent(socket: ServerWebSocket<SocketData>, event: ServerEvent): void {
  socket.send(JSON.stringify(event));
}

function sendProtocolError(socket: ServerWebSocket<SocketData>, error: ProtocolError): void {
  sendEvent(socket, errorEvent(error));
  socket.close(error.closeCode, error.message.slice(0, 120));
}

function handleSession(request: Request, config: AppConfig): Response {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin !== null && !config.allowedOrigins.includes(requestOrigin)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403);
  }

  const existingUserId = readDeviceId(request.headers.get("cookie"), config.cookieSecret);
  if (existingUserId) {
    return jsonResponse({ userId: existingUserId });
  }

  const userId = randomUUID();
  const cookie = createDeviceCookie(config.cookieSecret, userId);
  return jsonResponse({ userId }, 200, { "Set-Cookie": serializeDeviceCookie(cookie) });
}

function handleHealth(request: Request): Response {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  return jsonResponse({ status: "ok" });
}

function handleWebSocketUpgrade(request: Request, server: Server<SocketData>, config: AppConfig): Response | undefined {
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  if (!originAllowed(request, config)) {
    return jsonResponse({ error: "origin_not_allowed" }, 403);
  }

  const userId = readDeviceId(request.headers.get("cookie"), config.cookieSecret);
  if (!userId) {
    return jsonResponse({ error: "session_required" }, 401);
  }

  const upgraded = server.upgrade(request, {
    data: { userId, connectionId: randomUUID() },
  });

  return upgraded ? undefined : jsonResponse({ error: "upgrade_failed" }, 500);
}

export interface NexiPalsServer {
  readonly server: Server<SocketData>;
  readonly room: PresenceRoom;
}

export function startServer(config: AppConfig): NexiPalsServer {
  const room = new PresenceRoom();

  const server = Bun.serve<SocketData>({
    hostname: config.host,
    port: config.port,
    fetch(request, bunServer) {
      const url = new URL(request.url);

      if (url.pathname === "/api/session") {
        return handleSession(request, config);
      }

      if (url.pathname === "/healthz") {
        return handleHealth(request);
      }

      if (url.pathname === "/ws") {
        return handleWebSocketUpgrade(request, bunServer, config);
      }

      return new Response("Not found", { status: 404 });
    },
    websocket: {
      maxPayloadLength: config.maxFrameBytes,
      open(socket) {
        const { isFirstConnection, onlineUserIds } = room.add(socket);
        sendEvent(socket, { type: "session.ready", userId: socket.data.userId });
        sendEvent(socket, { type: "presence.snapshot", userIds: onlineUserIds });

        if (isFirstConnection) {
          room.broadcast({ type: "presence.joined", userId: socket.data.userId }, socket);
        }
      },
      message(socket, message) {
        if (typeof message !== "string") {
          sendProtocolError(socket, new ProtocolError("binary_not_supported", 1003, "Binary messages are not supported"));
          return;
        }

        try {
          const clientMessage = parseClientMessage(message, config.maxMessageLength, config.maxFrameBytes);
          room.broadcast({
            type: "chat.message",
            messageId: randomUUID(),
            userId: socket.data.userId,
            text: clientMessage.text,
            sentAt: Date.now(),
          });
        } catch (error) {
          if (error instanceof ProtocolError) {
            sendProtocolError(socket, error);
            return;
          }

          sendProtocolError(socket, new ProtocolError("invalid_message", 1007, "The message could not be processed"));
        }
      },
      close(socket) {
        const { isLastConnection } = room.remove(socket);
        if (isLastConnection) {
          room.broadcast({ type: "presence.left", userId: socket.data.userId });
        }
      },
    },
  });

  return { server, room };
}
