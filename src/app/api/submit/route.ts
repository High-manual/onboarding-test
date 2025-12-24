import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserIdFromRequest } from "@/lib/auth/user";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { QuestionCategory } from "@/lib/types";

const submissionSchema = z.object({
  attemptId: z.string().uuid(),
  responses: z
    .array(
      z.object({
        questionId: z.number(),
        selected: z.enum(["A", "B", "C"]),
      }),
    )
    .min(1),
});

type ScoreMap = Record<QuestionCategory, number>;

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

  const { data: attempt, error: attemptError } = await supabase
    .from("attempts")
    .select("id, student_id")
    .eq("id", parse.data.attemptId)
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json({ error: "응시 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  if (attempt.student_id !== userId) {
    return NextResponse.json({ error: "본인 응시만 제출할 수 있습니다." }, { status: 403 });
  }

  const questionIds = parse.data.responses.map((r) => r.questionId);
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, category, answer")
    .in("id", questionIds);

  if (questionsError || !questions) {
    return NextResponse.json({ error: questionsError?.message ?? "문항 조회 실패" }, { status: 500 });
  }

  const questionLookup = new Map<number, { answer: "A" | "B" | "C"; category: QuestionCategory }>();
  questions.forEach((q) => {
    questionLookup.set(q.id, { answer: q.answer as "A" | "B" | "C", category: q.category as QuestionCategory });
  });

  const responsesToInsert = parse.data.responses.map((response) => {
    const question = questionLookup.get(response.questionId);
    const isCorrect = question ? question.answer === response.selected : false;
    return {
      attempt_id: parse.data.attemptId,
      question_id: response.questionId,
      selected: response.selected,
      is_correct: isCorrect,
    };
  });

  const { error: insertError } = await supabase.from("responses").upsert(responsesToInsert);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const score: ScoreMap = { cs: 0, collab: 0, ai: 0 };

  responsesToInsert.forEach((resp) => {
    const question = questionLookup.get(resp.question_id);
    if (resp.is_correct && question) {
      score[question.category] += 1;
    }
  });

  const total = score.cs + score.collab + score.ai;

  const { error: attemptUpdateError } = await supabase
    .from("attempts")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      total_score: total,
      cs_score: score.cs,
      collab_score: score.collab,
      ai_score: score.ai,
    })
    .eq("id", parse.data.attemptId);

  if (attemptUpdateError) {
    return NextResponse.json({ error: attemptUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ total_score: total, breakdown: score });
}
