type SocketData = {
  readonly userId: string;
  //   readonly connectionId: string;
};

const server = Bun.serve<SocketData>({
  fetch: (request, server) => {
    if (server.upgrade(request)) {
      return;
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open: (ws) => console.log("Websocket opened:", ws.data.userId),
    close: (ws) => console.log("Websocket closed:", ws.data.userId),
    message: (ws, message) => {
      console.log(`Message Received from: ${ws.data.userId}:`, message);
    },
  },
});

console.info(`NexiPals listening on ${server.url}`);
