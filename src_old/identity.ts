import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { DEVICE_COOKIE_NAME, DEVICE_COOKIE_MAX_AGE_SECONDS } from "./config.js";

const COOKIE_VERSION = "v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    if (key === name) {
      return part.slice(separator + 1).trim() || null;
    }
  }

  return null;
}

export function createDeviceCookie(secret: string, userId = randomUUID()): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error("userId must be a UUID");
  }

  const payload = `${COOKIE_VERSION}.${userId}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readDeviceId(cookieHeader: string | null, secret: string): string | null {
  const value = getCookie(cookieHeader, DEVICE_COOKIE_NAME);
  if (!value) {
    return null;
  }

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== COOKIE_VERSION || !UUID_PATTERN.test(parts[1] ?? "")) {
    return null;
  }

  const payload = `${parts[0]}.${parts[1]}`;
  const expectedSignature = sign(payload, secret);
  const receivedSignature = parts[2] ?? "";
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);

  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null;
  }

  return parts[1] ?? null;
}

export function serializeDeviceCookie(value: string): string {
  return [
    `${DEVICE_COOKIE_NAME}=${value}`,
    `Max-Age=${DEVICE_COOKIE_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}
