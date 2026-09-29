import type { ServerWebSocket } from "bun";

export type SocketData = {
  readonly userId: string;
  character: "duck" | "frog" | "penguin";
};

export type ClientSocket = ServerWebSocket<SocketData>;

export class Room {
  private readonly clients = new Set<ClientSocket>();

  public add(client: ClientSocket): void {
    this.clients.add(client);
  }

  public remove(client: ClientSocket): void {
    this.clients.delete(client);
  }

  public users(): Array<Pick<SocketData, "userId" | "character">> {
    const users = new Map<string, Pick<SocketData, "userId" | "character">>();

    for (const client of this.clients) {
      users.set(client.data.userId, {
        userId: client.data.userId,
        character: client.data.character,
      });
    }

    return [...users.values()];
  }

  public broadcast(message: string): void {
    for (const client of this.clients) {
      client.send(message);
    }
  }
}
