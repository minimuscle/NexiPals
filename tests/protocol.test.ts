import { describe, expect, test } from "bun:test";

import { parseClientMessage, ProtocolError } from "../src_old/protocol.js";

describe("client protocol", () => {
  test("normalizes valid Unicode text and preserves emoji", () => {
    expect(
      parseClientMessage(
        JSON.stringify({ type: "chat.send", text: "Cafe\u0301 🐻" }),
        280,
        16_384,
      ),
    ).toEqual({
      type: "chat.send",
      text: "Café 🐻",
    });
  });

  test("counts grapheme clusters rather than UTF-16 code units", () => {
    expect(() =>
      parseClientMessage(
        JSON.stringify({ type: "chat.send", text: "👨‍👩‍👧‍👦" }),
        1,
        16_384,
      ),
    ).not.toThrow();
  });

  test("rejects empty and oversized messages", () => {
    expect(() =>
      parseClientMessage(
        JSON.stringify({ type: "chat.send", text: "   " }),
        280,
        16_384,
      ),
    ).toThrow(ProtocolError);
    expect(() =>
      parseClientMessage(
        JSON.stringify({ type: "chat.send", text: "hello" }),
        2,
        16_384,
      ),
    ).toThrow("cannot exceed 2");
    expect(() => parseClientMessage("x".repeat(100), 280, 10)).toThrow(
      "frame is too large",
    );
  });

  test("rejects malformed protocol messages", () => {
    expect(() => parseClientMessage("not-json", 280, 16_384)).toThrow(
      "valid JSON",
    );
    expect(() =>
      parseClientMessage(
        JSON.stringify({ type: "chat.send", text: 42 }),
        280,
        16_384,
      ),
    ).toThrow("must be a string");
    expect(() =>
      parseClientMessage(JSON.stringify({ type: "unknown" }), 280, 16_384),
    ).toThrow("Unsupported message type");
  });
});
