import { NextResponse } from "next/server";
import { createAdminSessionResponse, validateAdminPassword } from "@/lib/admin/session";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
  }

  if (!validateAdminPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  return createAdminSessionResponse();
}
