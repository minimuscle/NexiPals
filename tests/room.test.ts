import { describe, expect, test } from "bun:test";

import { PresenceRoom, type ClientSocket } from "../src_old/room.js";

function socket(userId: string, connectionId: string): ClientSocket {
  return {
    data: { userId, connectionId },
    send: () => 0,
  } as unknown as ClientSocket;
}

describe("presence room", () => {
  test("tracks multiple tabs as one logical user", () => {
    const room = new PresenceRoom();
    const firstTab = socket("user-a", "connection-a");
    const secondTab = socket("user-a", "connection-b");

    expect(room.add(firstTab)).toEqual({
      isFirstConnection: true,
      onlineUserIds: ["user-a"],
    });
    expect(room.add(secondTab)).toEqual({
      isFirstConnection: false,
      onlineUserIds: ["user-a"],
    });
    expect(room.remove(firstTab)).toEqual({ isLastConnection: false });
    expect(room.remove(secondTab)).toEqual({ isLastConnection: true });
    expect(room.onlineUserIds()).toEqual([]);
  });
});
