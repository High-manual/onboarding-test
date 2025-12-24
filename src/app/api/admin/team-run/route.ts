import { NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";

const payloadSchema = z.object({
  teamCount: z.number().int().positive(),
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
    return NextResponse.json({ error: "teamCount를 확인해주세요." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: teamRun, error: teamRunError } = await supabase
    .from("team_runs")
    .insert({ team_count: parse.data.teamCount })
    .select()
    .single();

  if (teamRunError || !teamRun) {
    return NextResponse.json({ error: teamRunError?.message ?? "팀 매칭을 생성하지 못했습니다." }, { status: 500 });
  }

  const teamsToCreate = Array.from({ length: parse.data.teamCount }).map((_, index) => ({
    team_run_id: teamRun.id,
    team_no: index + 1,
  }));

  const { data: teams, error: teamsError } = await supabase.from("teams").insert(teamsToCreate).select();

  if (teamsError || !teams) {
    return NextResponse.json({ error: teamsError?.message ?? "팀 생성 실패" }, { status: 500 });
  }

  const { data: attempts, error: attemptsError } = await supabase
    .from("attempts")
    .select("id, student_id, total_score")
    .order("total_score", { ascending: false, nullsFirst: false });

  if (attemptsError || !attempts) {
    return NextResponse.json({ error: attemptsError?.message ?? "응시 데이터를 가져오지 못했습니다." }, { status: 500 });
  }

  const members = attempts.map((attempt, index) => ({
    team_id: teams[index % teams.length].id,
    student_id: attempt.student_id,
  }));

  if (members.length > 0) {
    const { error: membersError } = await supabase.from("team_members").insert(members);
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ teamRun, teams, members });
}
