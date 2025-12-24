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

  const { data: teamRun, error: teamRunError } = await supabase
    .from("team_runs")
    .insert({ team_size: parse.data.teamSize, mode: parse.data.mode })
    .select()
    .single();

  if (teamRunError || !teamRun) {
    return NextResponse.json({ error: teamRunError?.message ?? "팀 매칭을 생성하지 못했습니다." }, { status: 500 });
  }

  const teamsToCreate = Array.from({ length: teamCount }).map((_, index) => ({
    run_id: teamRun.id,
    team_number: index + 1,
  }));

  const { data: teams, error: teamsError } = await supabase.from("teams").insert(teamsToCreate).select();

  if (teamsError || !teams) {
    return NextResponse.json({ error: teamsError?.message ?? "팀 생성 실패" }, { status: 500 });
  }

  const members = assignments.map((assignment) => ({
    team_id: teams[assignment.teamIndex].id,
    student_id: assignment.studentId,
    reason: assignment.reason,
  }));

  if (members.length > 0) {
    const { error: membersError } = await supabase.from("team_members").insert(members);
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ teamRun, teams, members, teamCount, mode: parse.data.mode });
}
