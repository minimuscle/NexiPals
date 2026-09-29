import type { ServerWebSocket } from "bun";

import type { ServerEvent } from "./protocol.js";

export interface SocketData {
  readonly userId: string;
  readonly connectionId: string;
}

export type ClientSocket = ServerWebSocket<SocketData>;

export class PresenceRoom {
  private readonly users = new Map<string, Set<ClientSocket>>();

  public add(socket: ClientSocket): { readonly isFirstConnection: boolean; readonly onlineUserIds: readonly string[] } {
    const existing = this.users.get(socket.data.userId);
    const isFirstConnection = existing === undefined;
    const connections = existing ?? new Set<ClientSocket>();
    connections.add(socket);
    this.users.set(socket.data.userId, connections);

    return { isFirstConnection, onlineUserIds: this.onlineUserIds() };
  }

  public remove(socket: ClientSocket): { readonly isLastConnection: boolean } {
    const connections = this.users.get(socket.data.userId);
    if (!connections) {
      return { isLastConnection: false };
    }

    connections.delete(socket);
    if (connections.size > 0) {
      return { isLastConnection: false };
    }

    this.users.delete(socket.data.userId);
    return { isLastConnection: true };
  }

  public onlineUserIds(): readonly string[] {
    return [...this.users.keys()];
  }

  public broadcast(event: ServerEvent, except?: ClientSocket): void {
    const payload = JSON.stringify(event);
    for (const connections of this.users.values()) {
      for (const socket of connections) {
        if (socket !== except) {
          socket.send(payload);
        }
      }
    }
  }
}
