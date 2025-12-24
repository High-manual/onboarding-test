"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Attempt, Question } from "@/lib/types";

type CategoryBreakdown = Record<"cs" | "collab" | "ai", number>;

interface SubmissionResult {
  total_score: number;
  breakdown: CategoryBreakdown;
}

export default function ExamPage() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<number, "A" | "B" | "C">>({});
  const [status, setStatus] = useState<"idle" | "loading" | "submitting" | "done">("idle");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/start");
        return;
      }
      setSessionToken(data.session.access_token);
    };
    fetchSession();
  }, [router, supabase]);

  useEffect(() => {
    if (!sessionToken) return;
    const load = async () => {
      setStatus("loading");
      const [questionsRes, attemptRes] = await Promise.all([
        fetch("/api/questions").then((r) => r.json()),
        fetch("/api/attempts", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }).then((r) => r.json()),
      ]);

      if (questionsRes.error) {
        setError(questionsRes.error);
        setStatus("idle");
        return;
      }

      setQuestions(questionsRes.questions ?? []);

      if (attemptRes.attempt) {
        setAttempt(attemptRes.attempt);
        setStatus("idle");
        return;
      }

      const created = await fetch("/api/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({}),
      }).then((r) => r.json());

      if (created.error) {
        setError(created.error);
        setStatus("idle");
        return;
      }

      setAttempt(created.attempt);
      setStatus("idle");
    };

    load();
  }, [sessionToken]);

  const handleSelect = (questionId: number, selected: "A" | "B" | "C") => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
  };

  const handleSubmit = async () => {
    if (!attempt || !sessionToken) return;
    setStatus("submitting");
    setError(null);

    const payload = {
      attemptId: attempt.id,
      responses: Object.entries(answers).map(([questionId, selected]) => ({
        questionId: Number(questionId),
        selected,
      })),
    };

    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "제출에 실패했습니다.");
      setStatus("idle");
      return;
    }

    setResult(json);
    setStatus("done");
  };

  const currentQuestion = questions[currentIndex];
  const progressText = `${currentIndex + 1} / ${questions.length || 1}`;

  if (!sessionToken) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
        <p>세션 확인 중...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: "28px", margin: 0 }}>시험 진행</h1>
          <p style={{ color: "#4b5563", marginTop: 4 }}>객관식 3지선다, 총 30문항</p>
        </div>
        <div style={{ fontWeight: 700 }}>{progressText}</div>
      </header>

      {error && <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>}

      {currentQuestion ? (
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            marginBottom: 20,
          }}
        >
          <p style={{ fontWeight: 700, marginBottom: 12 }}>
            [{currentQuestion.category.toUpperCase()}] {currentQuestion.prompt}
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {(["A", "B", "C"] as const).map((choiceKey) => {
              const choice =
                choiceKey === "A" ? currentQuestion.choice_a : choiceKey === "B" ? currentQuestion.choice_b : currentQuestion.choice_c;
              const isSelected = answers[currentQuestion.id] === choiceKey;
              return (
                <button
                  key={choiceKey}
                  onClick={() => handleSelect(currentQuestion.id, choiceKey)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isSelected ? "2px solid #111827" : "1px solid #e5e7eb",
                    background: isSelected ? "#111827" : "white",
                    color: isSelected ? "white" : "#111827",
                    fontWeight: 600,
                  }}
                >
                  {choiceKey}. {choice}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p>문항을 불러오는 중입니다.</p>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setCurrentIndex((v) => Math.max(0, v - 1))}
          disabled={currentIndex === 0}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "white",
          }}
        >
          이전
        </button>
        <button
          onClick={() => setCurrentIndex((v) => Math.min(questions.length - 1, v + 1))}
          disabled={currentIndex >= questions.length - 1}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "white",
          }}
        >
          다음
        </button>
        <div style={{ marginLeft: "auto" }} />
        <button
          onClick={handleSubmit}
          disabled={status === "submitting" || !attempt}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#111827",
            color: "white",
            border: "none",
            fontWeight: 700,
            opacity: status === "submitting" ? 0.7 : 1,
          }}
        >
          {status === "submitting" ? "채점 중..." : "제출하기"}
        </button>
      </div>

      {result && (
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 16,
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>점수</h2>
          <p style={{ margin: "4px 0" }}>총점: {result.total_score}</p>
          <p style={{ margin: "4px 0" }}>
            카테고리 별: CS {result.breakdown.cs ?? 0} / 협업 {result.breakdown.collab ?? 0} / AI{" "}
            {result.breakdown.ai ?? 0}
          </p>
        </div>
      )}
    </main>
  );
}
