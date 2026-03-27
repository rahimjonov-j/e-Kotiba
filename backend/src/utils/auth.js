import crypto from "node:crypto";
import { env } from "../config/env.js";

const KEY_LENGTH = 64;

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, passwordHash) => {
  if (!passwordHash || !passwordHash.includes(":")) return false;
  const [salt, storedHash] = passwordHash.split(":");
  const derivedHash = crypto.scryptSync(password, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== derivedHash.length) return false;
  return crypto.timingSafeEqual(storedBuffer, derivedHash);
};

export const generateSessionToken = () => crypto.randomBytes(48).toString("hex");

export const getSessionExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + env.sessionTtlHours);
  return expiresAt.toISOString();
};

export const parseCookies = (cookieHeader = "") =>
  cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, chunk) => {
      const separatorIndex = chunk.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = chunk.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(chunk.slice(separatorIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  secure: env.nodeEnv === "production",
  path: "/",
  maxAge: env.sessionTtlHours * 60 * 60 * 1000,
});

