import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerEnv } from "../env";

const SESSION_COOKIE = "admin_session";

export function assertAdminSession() {
  const session = cookies().get(SESSION_COOKIE);
  if (!session) {
    throw new Error("관리자 세션이 없습니다.");
  }
}

export function createAdminSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "true",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

export function validateAdminPassword(password: string): boolean {
  const env = getServerEnv();
  return password === env.ADMIN_PASSWORD;
}
