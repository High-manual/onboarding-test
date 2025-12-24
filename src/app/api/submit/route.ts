import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/auth/user";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { QuestionCategory } from "@/lib/types";
import { generateReport } from "@/lib/langgraph/report";

const submissionSchema = z.object({
  attemptId: z.string().uuid(),
  responses: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selected: z.enum(["A", "B", "C"]),
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
    .select("id, student_id")
    .eq("id", parse.data.attemptId)
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "응시 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  if (attempt.student_id !== student.id) {
    return NextResponse.json({ error: "본인 응시만 제출할 수 있습니다." }, { status: 403 });
  }

  const questionIds = parse.data.responses.map((r) => r.questionId);
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, correct_answer, category")
    .in("id", questionIds);

  if (questionsError || !questions) {
    return NextResponse.json({ error: questionsError?.message ?? "문항 조회 실패" }, { status: 500 });
  }

  const questionLookup = new Map<string, { correct_answer: "A" | "B" | "C"; category: QuestionCategory }>();
  questions.forEach((q) => {
    questionLookup.set(q.id, { 
      correct_answer: q.correct_answer as "A" | "B" | "C",
      category: q.category as QuestionCategory
    });
  });

  const responsesToInsert = parse.data.responses.map((response) => {
    const question = questionLookup.get(response.questionId);
    const isCorrect = question ? question.correct_answer === response.selected : false;
    return {
      attempt_id: parse.data.attemptId,
      question_id: response.questionId,
      selected_answer: response.selected,
      is_correct: isCorrect,
    };
  });

  const { error: insertError } = await supabase.from("responses").upsert(responsesToInsert);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 카테고리별 점수 계산
  const categoryScores: Record<QuestionCategory, { correct: number; total: number }> = {
    cs: { correct: 0, total: 0 },
    collab: { correct: 0, total: 0 },
    ai: { correct: 0, total: 0 },
  };

  parse.data.responses.forEach((response, index) => {
    const question = questionLookup.get(response.questionId);
    if (question) {
      categoryScores[question.category].total += 1;
      if (responsesToInsert[index].is_correct) {
        categoryScores[question.category].correct += 1;
      }
    }
  });

  const correctCount = responsesToInsert.filter((r) => r.is_correct).length;
  const totalCount = responsesToInsert.length;
  const score = Math.round((correctCount / totalCount) * 100);

  const report = await generateReport({
    studentName: student.name ?? null,
    score,
    correct: correctCount,
    total: totalCount,
    categoryScores,
  });

  const { error: attemptUpdateError } = await supabase
    .from("attempts")
    .update({
      submitted_at: new Date().toISOString(),
      score: score,
      cs_score: categoryScores.cs.correct,
      collab_score: categoryScores.collab.correct,
      ai_score: categoryScores.ai.correct,
      report: {
        ...report,
        generated_at: new Date().toISOString(),
      },
    })
    .eq("id", parse.data.attemptId);

  if (attemptUpdateError) {
    return NextResponse.json({ error: attemptUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    score, 
    correct: correctCount, 
    total: totalCount,
    cs_score: categoryScores.cs.correct,
    collab_score: categoryScores.collab.correct,
    ai_score: categoryScores.ai.correct,
    report,
  });
}
