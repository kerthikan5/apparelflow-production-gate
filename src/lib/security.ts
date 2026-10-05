import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { db } from "./db";
import type { Role } from "@prisma/client";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${hash.toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  const actual = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function sessionToken(req: Request) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("af_session="))
    ?.slice(11);
}
export async function authenticate(req: Request, roles?: Role[]) {
  const token = sessionToken(req);
  const session = token
    ? await db.session.findUnique({
        where: { id: tokenHash(token) },
        include: { user: true },
      })
    : null;
  if (!session || session.expiresAt <= new Date())
    throw new HttpError(401, "Please sign in.");
  if (roles && !roles.includes(session.user.role))
    throw new HttpError(403, "Your role cannot perform this action.");
  return session.user;
}
export function protectOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = process.env.APP_ORIGIN;
  if (!allowed) throw new HttpError(503, "APP_ORIGIN must be configured.");
  if (origin && origin !== allowed)
    throw new HttpError(403, "Cross-origin request blocked.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-site request blocked.");
}
