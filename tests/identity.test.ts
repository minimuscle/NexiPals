import { describe, expect, test } from "bun:test";

import { DEVICE_COOKIE_NAME } from "../src_old/config.js";
import {
  createDeviceCookie,
  readDeviceId,
  serializeDeviceCookie,
} from "../src_old/identity.js";

const SECRET = "test-secret-that-is-long-enough-for-tests";
const USER_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("device identity", () => {
  test("round-trips a signed device cookie", () => {
    const cookie = createDeviceCookie(SECRET, USER_ID);
    expect(readDeviceId(`${DEVICE_COOKIE_NAME}=${cookie}`, SECRET)).toBe(
      USER_ID,
    );
  });

  test("rejects tampered cookies and accepts a new cookie value", () => {
    const cookie = createDeviceCookie(SECRET, USER_ID);
    expect(
      readDeviceId(`${DEVICE_COOKIE_NAME}=${cookie}tampered`, SECRET),
    ).toBeNull();
    expect(readDeviceId(null, SECRET)).toBeNull();
  });

  test("serializes a secure host-only cookie", () => {
    const serialized = serializeDeviceCookie(
      createDeviceCookie(SECRET, USER_ID),
    );
    expect(serialized).toContain(`${DEVICE_COOKIE_NAME}=`);
    expect(serialized).toContain("HttpOnly");
    expect(serialized).toContain("Secure");
    expect(serialized).toContain("SameSite=Strict");
    expect(serialized).toContain("Path=/");
  });
});
