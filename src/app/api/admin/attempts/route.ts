import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { QuestionCategory } from "@/lib/types";

export async function GET() {
  try {
    assertAdminSession();
  } catch {
    return NextResponse.json({ error: "관리자 인증 필요" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      `
        id,
        student_id,
        score,
        cs_score,
        collab_score,
        ai_score,
        created_at,
        submitted_at,
        students:student_id ( name )
      `,
    )
    .order("score", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ attempts: [] });
  }

  // 각 attempt의 responses 조회
  const attemptIds = data.map((a) => a.id);
  const { data: responses, error: responsesError } = await supabase
    .from("responses")
    .select("attempt_id, question_id, selected_answer, is_correct")
    .in("attempt_id", attemptIds);

  if (responsesError) {
    return NextResponse.json({ error: responsesError.message }, { status: 500 });
  }

  // questions 조회 (카테고리 정보 필요)
  const questionIds = responses
    ? [...new Set(responses.map((r) => r.question_id))]
    : [];
  
  let questionMap = new Map<string, QuestionCategory>();
  if (questionIds.length > 0) {
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, category")
      .in("id", questionIds);

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    if (questions) {
      questions.forEach((q) => {
        questionMap.set(q.id, q.category as QuestionCategory);
      });
    }
  }

  // 각 attempt별로 카테고리별 통계 계산
  const attemptsWithStats = data.map((attempt) => {
    const attemptResponses = responses?.filter((r) => r.attempt_id === attempt.id) || [];
    
    const categoryStats: Record<QuestionCategory, { total: number; correct: number; pass: number }> = {
      cs: { total: 0, correct: 0, pass: 0 },
      collab: { total: 0, correct: 0, pass: 0 },
      ai: { total: 0, correct: 0, pass: 0 },
    };

    attemptResponses.forEach((response) => {
      const category = questionMap.get(response.question_id);
      if (category && category in categoryStats) {
        categoryStats[category].total += 1;
        if (response.is_correct) {
          categoryStats[category].correct += 1;
        }
        if (response.selected_answer === "E") {
          categoryStats[category].pass += 1;
        }
      }
    });

    return {
      ...attempt,
      category_stats: categoryStats,
    };
  });

  return NextResponse.json({ attempts: attemptsWithStats });
}
