export const DEVICE_COOKIE_NAME = "__Host-nexipals_device";
export const DEFAULT_MAX_MESSAGE_LENGTH = 280;
export const DEFAULT_MAX_FRAME_BYTES = 16_384;
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly cookieSecret: string;
  readonly allowedOrigins: readonly string[];
  readonly maxMessageLength: number;
  readonly maxFrameBytes: number;
}

function parsePositiveInteger(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseAllowedOrigins(value: string | undefined): readonly string[] {
  const origins = (value ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error("NEXIPALS_ALLOWED_ORIGINS must contain explicit origins and cannot use '*'");
  }

  const normalizedOrigins = new Set<string>();
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`NEXIPALS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(`NEXIPALS_ALLOWED_ORIGINS must contain origins only: ${origin}`);
    }

    normalizedOrigins.add(parsed.origin);
  }

  return [...normalizedOrigins];
}

export function loadConfig(env: Record<string, string | undefined> = Bun.env): AppConfig {
  const cookieSecret = env.NEXIPALS_COOKIE_SECRET;
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error("NEXIPALS_COOKIE_SECRET must be at least 32 characters long");
  }

  const maxMessageLength = parsePositiveInteger(
    env.NEXIPALS_MAX_MESSAGE_LENGTH,
    "NEXIPALS_MAX_MESSAGE_LENGTH",
    DEFAULT_MAX_MESSAGE_LENGTH,
  );

  if (maxMessageLength > 10_000) {
    throw new Error("NEXIPALS_MAX_MESSAGE_LENGTH cannot exceed 10000");
  }

  return {
    host: env.NEXIPALS_HOST?.trim() || "127.0.0.1",
    port: parsePositiveInteger(env.NEXIPALS_PORT, "NEXIPALS_PORT", 3001),
    cookieSecret,
    allowedOrigins: parseAllowedOrigins(env.NEXIPALS_ALLOWED_ORIGINS),
    maxMessageLength,
    maxFrameBytes: DEFAULT_MAX_FRAME_BYTES,
  };
}
