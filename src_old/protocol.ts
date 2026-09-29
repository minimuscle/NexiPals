export type ClientMessage = {
  readonly type: "chat.send";
  readonly text: string;
};

export type ServerEvent =
  | { readonly type: "session.ready"; readonly userId: string }
  | { readonly type: "presence.snapshot"; readonly userIds: readonly string[] }
  | { readonly type: "presence.joined"; readonly userId: string }
  | { readonly type: "presence.left"; readonly userId: string }
  | {
      readonly type: "chat.message";
      readonly messageId: string;
      readonly userId: string;
      readonly text: string;
      readonly sentAt: number;
    }
  | { readonly type: "error"; readonly code: string; readonly message: string };

export class ProtocolError extends Error {
  public constructor(
    public readonly code: string,
    public readonly closeCode: 1003 | 1007 | 1008 | 1009,
    message: string,
  ) {
    super(message);
    this.name = "ProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countGraphemes(value: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).length;
}

export function parseClientMessage(raw: string, maxMessageLength: number, maxFrameBytes: number): ClientMessage {
  const byteLength = new TextEncoder().encode(raw).byteLength;
  if (byteLength > maxFrameBytes) {
    throw new ProtocolError("message_too_large", 1009, "The message frame is too large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ProtocolError("invalid_json", 1007, "The message must contain valid JSON");
  }

  if (!isRecord(parsed) || parsed.type !== "chat.send") {
    throw new ProtocolError("unsupported_message", 1003, "Unsupported message type");
  }

  if (typeof parsed.text !== "string") {
    throw new ProtocolError("invalid_text", 1007, "Message text must be a string");
  }

  const text = parsed.text.normalize("NFC");
  if (text.trim().length === 0) {
    throw new ProtocolError("empty_message", 1008, "Message text cannot be empty");
  }

  if (countGraphemes(text) > maxMessageLength) {
    throw new ProtocolError("message_too_long", 1008, `Message text cannot exceed ${maxMessageLength} characters`);
  }

  return { type: "chat.send", text };
}

export function errorEvent(error: ProtocolError): ServerEvent {
  return { type: "error", code: error.code, message: error.message };
}
