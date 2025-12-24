import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth/user";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  
  // user_id로 student_id 찾기
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  // 기존 응시 확인 - 이미 있으면 생성하지 않음
  const { data: existing } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", student.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "이미 응시를 시작했습니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attempts")
    .insert({
      student_id: student.id,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "응시 생성 실패" }, { status: 500 });
  }

  return NextResponse.json({ attempt: data });
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  
  // user_id로 student_id 찾기
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!student) {
    return NextResponse.json({ attempt: null });
  }

  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", student.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attempt: data ?? null });
}
