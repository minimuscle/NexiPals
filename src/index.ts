import { getOrCreateUserId, serializeUserCookie } from "./identity.js";
import { Room, type SocketData } from "./room.js";

const room = new Room();

const server = Bun.serve<SocketData>({
  fetch: (request, server) => {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("Successfully Connected to Server", { status: 200 });
    }
    const identity = getOrCreateUserId(
      request.headers.get("cookie"),
      url.searchParams.get("userId"),
    );
    const character =
      (url.searchParams.get("character") as "duck" | "frog" | "penguin") ?? //TODO: make this not hardcoded
      "duck";

    const upgradeOptions = identity.isNew
      ? {
          data: { userId: identity.userId, character },
          headers: { "Set-Cookie": serializeUserCookie(identity.userId) },
        }
      : { data: { userId: identity.userId, character } };
    const upgraded = server.upgrade(request, upgradeOptions);
    if (upgraded) return; // Websockets takes over from here
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open: (ws) => {
      room.add(ws);
      room.broadcast(
        JSON.stringify({
          type: "connected",
          userId: ws.data.userId,
          character: ws.data.character,
          connectedUsers: room.users(),
        }),
      );
      console.log("Websocket opened:", ws.data.userId);
    },
    close: (ws) => {
      room.remove(ws);
      room.broadcast(
        JSON.stringify({
          type: "disconnected",
          userId: ws.data.userId,
          character: ws.data.character,
        }),
      );
      console.log("Websocket closed:", ws.data.userId);
    },
    message: (ws, message) => {
      const event = JSON.stringify({
        type: "message",
        userId: ws.data.userId,
        message: String(message),
      });
      room.broadcast(event);
      console.log(`Message Received from: ${ws.data.userId}:`, message);
    },
  },
});

console.info(`NexiPals listening on ${server.url}`);
