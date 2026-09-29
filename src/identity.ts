import { randomUUID } from "node:crypto";

export const USER_COOKIE_NAME = "nexipals_user";
const USER_COOKIE_MAX_AGE_SECONDS = 31_536_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUserId(value: string | null): value is string {
  return value !== null && UUID_PATTERN.test(value);
}

function readCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }

    if (part.slice(0, separator).trim() === USER_COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();
      return UUID_PATTERN.test(value) ? value : null;
    }
  }

  return null;
}

export function getOrCreateUserId(
  cookieHeader: string | null,
  requestedUserId: string | null = null,
): {
  readonly userId: string;
  readonly isNew: boolean;
} {
  if (isUserId(requestedUserId)) {
    return { userId: requestedUserId, isNew: false };
  }

  const savedUserId = readCookie(cookieHeader);
  if (savedUserId) {
    return { userId: savedUserId, isNew: false };
  }

  return { userId: randomUUID(), isNew: true };
}

export function serializeUserCookie(userId: string): string {
  return [
    `${USER_COOKIE_NAME}=${userId}`,
    `Max-Age=${USER_COOKIE_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
  ].join("; ");
}
