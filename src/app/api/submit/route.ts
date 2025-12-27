import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/auth/user";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import type { QuestionCategory } from "@/lib/types";
// import { generateReport } from "@/lib/langgraph/report";

const submissionSchema = z.object({
  attemptId: z.string().uuid(),
  responses: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selected: z.enum(["A", "B", "C", "D", "E", "X"]),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const json = await request.json();
  const parse = submissionSchema.safeParse(json);
  if (!parse.success) {
    return NextResponse.json({ error: "payload를 확인해주세요." }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // user_id로 student_id 찾기
  const { data: student } = await supabase
    .from("students")
    .select("id, name")
    .eq("user_id", userId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "학생 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("id, student_id, submitted_at")
    .eq("id", parse.data.attemptId)
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "응시 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  if (attempt.student_id !== student.id) {
    return NextResponse.json({ error: "본인 응시만 제출할 수 있습니다." }, { status: 403 });
  }

  // 중복 제출 방지
  if (attempt.submitted_at) {
    return NextResponse.json({ error: "이미 제출된 응시입니다." }, { status: 400 });
  }

  const questionIds = parse.data.responses.map((r) => r.questionId);
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, correct_answer, category")
    .in("id", questionIds);

  if (questionsError || !questions) {
    return NextResponse.json({ error: questionsError?.message ?? "문항 조회 실패" }, { status: 500 });
  }

  const questionLookup = new Map<string, { correct_answer: "A" | "B" | "C" | "D" | "E"; category: QuestionCategory }>();
  questions.forEach((q) => {
    questionLookup.set(q.id, { 
      correct_answer: q.correct_answer as "A" | "B" | "C" | "D" | "E",
      category: q.category as QuestionCategory
    });
  });

  const responsesToInsert = parse.data.responses.map((response) => {
    const question = questionLookup.get(response.questionId);
    // "X"는 틀린 것으로 처리
    const isCorrect = question && response.selected !== "X" ? question.correct_answer === response.selected : false;
    return {
      attempt_id: parse.data.attemptId,
      question_id: response.questionId,
      selected_answer: response.selected,
      is_correct: isCorrect,
    };
  });

  // 버전 확인
  const env = getServerEnv();
  const statsVersion = env.ATTEMPTS_STATS_VERSION || "v1";

  // 카테고리별 점수 계산
  const categoryScores: Record<QuestionCategory, { correct: number; total: number; pass: number; timeout: number }> = {
    cs: { correct: 0, total: 0, pass: 0, timeout: 0 },
    collab: { correct: 0, total: 0, pass: 0, timeout: 0 },
    ai: { correct: 0, total: 0, pass: 0, timeout: 0 },
  };

  parse.data.responses.forEach((response, index) => {
    const question = questionLookup.get(response.questionId);
    if (question) {
      categoryScores[question.category].total += 1;
      if (responsesToInsert[index].is_correct) {
        categoryScores[question.category].correct += 1;
      }
      if (response.selected === "E") {
        categoryScores[question.category].pass += 1;
      }
      if (response.selected === "X") {
        categoryScores[question.category].timeout += 1;
      }
    }
  });

  const correctCount = responsesToInsert.filter((r) => r.is_correct).length;
  const totalCount = responsesToInsert.length;
  const score = Math.round((correctCount / totalCount) * 100);

  // 트랜잭션처럼 처리: responses upsert와 attempts update를 순차 실행하되,
  // submitted_at을 조건으로 추가하여 중복 제출 방지
  const { error: insertError } = await supabase.from("responses").upsert(responsesToInsert);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // const report = await generateReport({
  //   studentName: student.name ?? null,
  //   score,
  //   correct: correctCount,
  //   total: totalCount,
  //   categoryScores,
  // });

  // submitted_at이 null인 경우에만 업데이트 (중복 제출 방지)
  const updateData: any = {
    submitted_at: new Date().toISOString(),
    score: score,
    cs_score: categoryScores.cs.correct,
    collab_score: categoryScores.collab.correct,
    ai_score: categoryScores.ai.correct,
    // report: {
    //   ...report,
    //   generated_at: new Date().toISOString(),
    // },
  };

  // v2: 카테고리별 pass/timeout/total 점수도 저장
  if (statsVersion === "v2") {
    updateData.cs_pass_score = categoryScores.cs.pass;
    updateData.collab_pass_score = categoryScores.collab.pass;
    updateData.ai_pass_score = categoryScores.ai.pass;
    updateData.cs_timeout_score = categoryScores.cs.timeout;
    updateData.collab_timeout_score = categoryScores.collab.timeout;
    updateData.ai_timeout_score = categoryScores.ai.timeout;
    updateData.cs_total_score = categoryScores.cs.total;
    updateData.collab_total_score = categoryScores.collab.total;
    updateData.ai_total_score = categoryScores.ai.total;
  }

  const { error: attemptUpdateError } = await supabase
    .from("attempts")
    .update(updateData)
    .eq("id", parse.data.attemptId)
    .is("submitted_at", null);

  if (attemptUpdateError) {
    return NextResponse.json({ error: attemptUpdateError.message }, { status: 500 });
  }

  // 업데이트가 실제로 발생했는지 확인 (다른 요청이 먼저 제출한 경우)
  const { data: updatedAttempt } = await supabase
    .from("attempts")
    .select("submitted_at")
    .eq("id", parse.data.attemptId)
    .single();

  if (!updatedAttempt?.submitted_at) {
    return NextResponse.json({ error: "제출 처리 중 오류가 발생했습니다. 다시 시도해주세요." }, { status: 409 });
  }

  return NextResponse.json({ 
    score, 
    correct: correctCount, 
    total: totalCount,
    cs_score: categoryScores.cs.correct,
    collab_score: categoryScores.collab.correct,
    ai_score: categoryScores.ai.correct,
    // report,
  });
}
