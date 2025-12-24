import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/auth/user";
import { getServiceSupabase } from "@/lib/supabase/server";

const createSchema = z.object({
  status: z.enum(["in_progress", "submitted", "graded"]).optional(),
});

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const payload = await request.json();
  const parse = createSchema.safeParse(payload);
  if (!parse.success) {
    return NextResponse.json({ error: "payload를 확인해주세요." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      student_id: userId,
      status: parse.data.status ?? "in_progress",
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
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("student_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attempt: data ?? null });
}
