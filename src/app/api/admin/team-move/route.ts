import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";

const payloadSchema = z.object({
  studentId: z.string().uuid(),
  fromTeamId: z.string().uuid().optional(),
  toTeamId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    assertAdminSession();
  } catch {
    return NextResponse.json({ error: "관리자 인증 필요" }, { status: 401 });
  }

  const json = await request.json();
  const parse = payloadSchema.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ error: "payload를 확인해주세요." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  if (parse.data.fromTeamId) {
    const { error: deleteError } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", parse.data.fromTeamId)
      .eq("student_id", parse.data.studentId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const { error: insertError } = await supabase.from("team_members").upsert({
    team_id: parse.data.toTeamId,
    student_id: parse.data.studentId,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
