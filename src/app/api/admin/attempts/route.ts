import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import type { QuestionCategory } from "@/lib/types";

interface CategoryStats {
  total: number;
  correct: number;
  pass: number;
  timeout: number;
}

export async function GET() {
  try {
    assertAdminSession();
  } catch {
    return NextResponse.json({ error: "관리자 인증 필요" }, { status: 401 });
  }

  // 버전 확인
  const env = getServerEnv();
  const statsVersion = env.ATTEMPTS_STATS_VERSION || "v1";

  const supabase = getServiceSupabase();

  // v2: attempts 테이블에서 모든 통계 컬럼 조회
  if (statsVersion === "v2") {
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
          cs_pass_score,
          collab_pass_score,
          ai_pass_score,
          cs_timeout_score,
          collab_timeout_score,
          ai_timeout_score,
          cs_total_score,
          collab_total_score,
          ai_total_score,
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

    const attemptsWithStats = data.map((attempt: any) => {
      const categoryStats: Record<QuestionCategory, CategoryStats> = {
        cs: {
          total: attempt.cs_total_score ?? 0,
          correct: attempt.cs_score ?? 0,
          pass: attempt.cs_pass_score ?? 0,
          timeout: attempt.cs_timeout_score ?? 0,
        },
        collab: {
          total: attempt.collab_total_score ?? 0,
          correct: attempt.collab_score ?? 0,
          pass: attempt.collab_pass_score ?? 0,
          timeout: attempt.collab_timeout_score ?? 0,
        },
        ai: {
          total: attempt.ai_total_score ?? 0,
          correct: attempt.ai_score ?? 0,
          pass: attempt.ai_pass_score ?? 0,
          timeout: attempt.ai_timeout_score ?? 0,
        },
      };

      const timeoutCount = (attempt.cs_timeout_score ?? 0) + 
                           (attempt.collab_timeout_score ?? 0) + 
                           (attempt.ai_timeout_score ?? 0);

      return {
        id: attempt.id,
        student_id: attempt.student_id,
        score: attempt.score,
        cs_score: attempt.cs_score,
        collab_score: attempt.collab_score,
        ai_score: attempt.ai_score,
        created_at: attempt.created_at,
        submitted_at: attempt.submitted_at,
        students: attempt.students,
        category_stats: categoryStats,
        timeout_count: timeoutCount,
      };
    });

    return NextResponse.json({ attempts: attemptsWithStats });
  }

  // v1: 기존 로직 (responses 테이블에서 계산)
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

  const attemptIds = data.map((a) => a.id);

  // 각 attempt별로 카테고리별 통계 계산
  const statsPromises = attemptIds.map(async (attemptId) => {
    const { data: responses } = await supabase
      .from("responses")
      .select("question_id, selected_answer, is_correct, questions!inner(category)")
      .eq("attempt_id", attemptId);

    const categoryStats: Record<QuestionCategory, CategoryStats> = {
      cs: { total: 0, correct: 0, pass: 0, timeout: 0 },
      collab: { total: 0, correct: 0, pass: 0, timeout: 0 },
      ai: { total: 0, correct: 0, pass: 0, timeout: 0 },
    };

    let timeoutCount = 0;

    (responses || []).forEach((r: any) => {
      const category = r.questions?.category as QuestionCategory;
      if (!category || !(category in categoryStats)) return;

      categoryStats[category].total += 1;
      if (r.is_correct === true) {
        categoryStats[category].correct += 1;
      }
      if (r.selected_answer === "E") {
        categoryStats[category].pass += 1;
      }
      if (r.selected_answer === "X") {
        categoryStats[category].timeout += 1;
        timeoutCount += 1;
      }
    });

    return { attemptId, categoryStats, timeoutCount };
  });

  const statsResults = await Promise.all(statsPromises);
  const statsMap = new Map(statsResults.map(s => [s.attemptId, s]));

  const attemptsWithStats = data.map((attempt) => {
    const stats = statsMap.get(attempt.id);
    return {
      ...attempt,
      category_stats: stats?.categoryStats || {
        cs: { total: 0, correct: 0, pass: 0, timeout: 0 },
        collab: { total: 0, correct: 0, pass: 0, timeout: 0 },
        ai: { total: 0, correct: 0, pass: 0, timeout: 0 },
      },
      timeout_count: stats?.timeoutCount || 0,
    };
  });

  return NextResponse.json({ attempts: attemptsWithStats });
}
