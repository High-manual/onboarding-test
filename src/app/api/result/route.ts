import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth/user";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const attemptId = searchParams.get("attemptId");

  if (!attemptId) {
    return NextResponse.json({ error: "attemptId가 필요합니다." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // 병렬 쿼리 실행으로 성능 최적화
  const [studentResult, attemptResult] = await Promise.all([
    supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("attempts")
      .select("*")
      .eq("id", attemptId)
      .single(),
  ]);

  const { data: student, error: studentError } = studentResult;
  const { data: attempt, error: attemptError } = attemptResult;

  if (studentError || !student) {
    return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "응시 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  if (attempt.student_id !== student.id) {
    return NextResponse.json({ error: "본인 응시 내역만 조회할 수 있습니다." }, { status: 403 });
  }

  // responses 조회
  const { data: responses, error: responsesError } = await supabase
    .from("responses")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: true });

  if (responsesError) {
    return NextResponse.json({ error: responsesError.message }, { status: 500 });
  }

  if (!responses || responses.length === 0) {
    return NextResponse.json({ error: "응답을 찾을 수 없습니다." }, { status: 404 });
  }

  // 필요한 question_id만 추출하여 조회
  const questionIds = responses.map((r) => r.question_id);
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .in("id", questionIds);

  if (questionsError || !questions) {
    return NextResponse.json({ error: questionsError?.message ?? "문항 조회 실패" }, { status: 500 });
  }

  // responses와 questions를 매칭하여 결과 생성
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const result = responses.map((response) => {
    const question = questionMap.get(response.question_id);
    return {
      question: question,
      selected: response.selected_answer,
      isCorrect: response.is_correct,
    };
  });

  return NextResponse.json({
    attempt,
    result,
  });
}

