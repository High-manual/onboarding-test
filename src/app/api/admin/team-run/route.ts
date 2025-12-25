import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";
import { matchTeams } from "@/lib/langgraph/team-matching";

const payloadSchema = z.object({
  teamSize: z.number().int().positive(),
  mode: z.enum(["rank", "balanced"]).default("rank"),
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
    return NextResponse.json({ error: "teamSize를 확인해주세요." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // 제출된 응시만 가져오기
  const { data: attempts, error: attemptsError } = await supabase
    .from("attempts")
    .select("id, student_id, score, cs_score, collab_score, ai_score")
    .not("submitted_at", "is", null)
    .order("score", { ascending: false, nullsFirst: false });

  if (attemptsError || !attempts || attempts.length === 0) {
    return NextResponse.json({ error: attemptsError?.message ?? "제출된 응시가 없습니다." }, { status: 500 });
  }

  const { teamCount, assignments } = await matchTeams(attempts, parse.data.teamSize, parse.data.mode);

  // DB에 저장하지 않고 결과만 반환 (보기 전용)
  const teams = Array.from({ length: teamCount }).map((_, index) => ({
    team_number: index + 1,
    members: assignments
      .filter(a => a.teamIndex === index)
      .map(a => {
        const attempt = attempts.find(at => at.student_id === a.studentId);
        return {
          student_id: a.studentId,
          attempt_id: a.attemptId,
          reason: a.reason,
          score: attempt?.score ?? 0,
        };
      }),
  }));

  return NextResponse.json({ teams, teamCount, mode: parse.data.mode, teamSize: parse.data.teamSize });
}
