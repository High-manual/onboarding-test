import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";

// 저장된 팀 불러오기
export async function GET() {
  try {
    assertAdminSession();
  } catch {
    return NextResponse.json({ error: "관리자 인증 필요" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // 가장 최근 team_run 가져오기
  const { data: teamRun, error: teamRunError } = await supabase
    .from("team_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (teamRunError || !teamRun) {
    return NextResponse.json({ teams: null, message: "저장된 팀이 없습니다." });
  }

  // 해당 run의 팀들 가져오기
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .eq("run_id", teamRun.id)
    .order("team_number", { ascending: true });

  if (teamsError || !teams) {
    return NextResponse.json({ error: teamsError?.message ?? "팀 불러오기 실패" }, { status: 500 });
  }

  // 각 팀의 멤버들 가져오기
  const teamIds = teams.map(t => t.id);
  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("*")
    .in("team_id", teamIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  // 학생 정보 가져오기
  const studentIds = [...new Set((members || []).map(m => m.student_id))];
  const { data: students } = await supabase
    .from("students")
    .select("id, name")
    .in("id", studentIds);

  // 응시 정보 가져오기
  const { data: attemptsData } = await supabase
    .from("attempts")
    .select("student_id, score")
    .in("student_id", studentIds);

  // 팀별로 멤버 그룹화
  const teamsWithMembers = teams.map(team => {
    const teamMembers = (members || [])
      .filter(m => m.team_id === team.id)
      .map(m => {
        const student = students?.find(s => s.id === m.student_id);
        const attempt = attemptsData?.find(a => a.student_id === m.student_id);
        return {
          student_id: m.student_id,
          student_name: student?.name ?? "익명",
          score: attempt?.score ?? 0,
          reason: m.reason,
        };
      });

    return {
      id: team.id,
      team_number: team.team_number,
      members: teamMembers,
    };
  });

  return NextResponse.json({
    teamRun,
    teams: teamsWithMembers,
  });
}

// 팀 저장/업데이트
export async function POST(request: Request) {
  try {
    assertAdminSession();
  } catch {
    return NextResponse.json({ error: "관리자 인증 필요" }, { status: 401 });
  }

  const json = await request.json();
  const { teams, teamSize, mode } = json;

  if (!teams || !Array.isArray(teams)) {
    return NextResponse.json({ error: "팀 데이터가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // 기존 team_run이 있는지 확인
  const { data: existingRun } = await supabase
    .from("team_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let teamRunId: string;

  if (existingRun) {
    // 기존 run 업데이트
    const { data: updatedRun, error: updateError } = await supabase
      .from("team_runs")
      .update({ team_size: teamSize, mode })
      .eq("id", existingRun.id)
      .select()
      .single();

    if (updateError || !updatedRun) {
      return NextResponse.json({ error: updateError?.message ?? "팀 run 업데이트 실패" }, { status: 500 });
    }

    teamRunId = updatedRun.id;

    // 기존 팀과 멤버 삭제
    const { data: existingTeams } = await supabase
      .from("teams")
      .select("id")
      .eq("run_id", teamRunId);

    if (existingTeams && existingTeams.length > 0) {
      const existingTeamIds = existingTeams.map(t => t.id);
      await supabase.from("team_members").delete().in("team_id", existingTeamIds);
      await supabase.from("teams").delete().eq("run_id", teamRunId);
    }
  } else {
    // 새 run 생성
    const { data: newRun, error: createError } = await supabase
      .from("team_runs")
      .insert({ team_size: teamSize, mode })
      .select()
      .single();

    if (createError || !newRun) {
      return NextResponse.json({ error: createError?.message ?? "팀 run 생성 실패" }, { status: 500 });
    }

    teamRunId = newRun.id;
  }

  // 팀 생성
  const teamsToCreate = teams.map((team: any) => ({
    run_id: teamRunId,
    team_number: team.team_number,
  }));

  const { data: createdTeams, error: teamsError } = await supabase
    .from("teams")
    .insert(teamsToCreate)
    .select();

  if (teamsError || !createdTeams) {
    return NextResponse.json({ error: teamsError?.message ?? "팀 생성 실패" }, { status: 500 });
  }

  // 멤버 생성
  const membersToCreate: any[] = [];
  teams.forEach((team: any, index: number) => {
    const teamId = createdTeams[index].id;
    team.members.forEach((member: any) => {
      membersToCreate.push({
        team_id: teamId,
        student_id: member.student_id,
        reason: member.reason || null,
      });
    });
  });

  if (membersToCreate.length > 0) {
    const { error: membersError } = await supabase.from("team_members").insert(membersToCreate);
    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, teamRunId });
}

