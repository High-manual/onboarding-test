"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Attempt, Question } from "@/lib/types";

interface SubmissionResult {
  score: number;
  correct: number;
  total: number;
  cs_score: number;
  collab_score: number;
  ai_score: number;
  report: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

function getCategoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const normalized = category.trim().toLowerCase();
  switch (normalized) {
    case "cs":
      return "CS";
    case "collab":
      return "협업";
    case "ai":
      return "AI";
    default:
      return normalized.toUpperCase();
  }
}

export default function ExamPage() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C">>({});
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

  const handleSelect = (questionId: string, selected: "A" | "B" | "C") => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
  };

  const handleSubmit = async () => {
    if (!attempt || !sessionToken) return;
    setStatus("submitting");
    setError(null);

    const payload = {
      attemptId: attempt.id,
      responses: Object.entries(answers).map(([questionId, selected]) => ({
        questionId,
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
  const categoryLabel = currentQuestion ? getCategoryLabel(currentQuestion.category) : null;

  if (!sessionToken) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
        <p>세션 확인 중...</p>
      </main>
    );
  }

  return (
    <main style={{ 
      minHeight: "100vh",
      background: "#f9fafb",
      padding: "24px 16px"
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <header style={{ 
          background: "white",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <div>
            <h1 style={{ fontSize: "28px", margin: 0, fontWeight: 700 }}>프로젝트 역량 평가</h1>
            <p style={{ color: "#6b7280", marginTop: 4, margin: 0 }}>총 30문항</p>
          </div>
          <div style={{ 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "8px 16px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: "18px"
          }}>
            {progressText}
          </div>
        </header>

        {error && (
          <div style={{ 
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b", 
            padding: 16,
            borderRadius: 12,
            marginBottom: 20
          }}>
            {error}
          </div>
        )}

        {currentQuestion ? (
          <div
            style={{
              background: "white",
              padding: 32,
              borderRadius: 12,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
              marginBottom: 20,
            }}
          >
            {categoryLabel && (
              <div style={{ 
                display: "inline-block",
                background: categoryLabel === "CS" ? "#eff6ff" : 
                           categoryLabel === "협업" ? "#f0fdf4" : "#faf5ff",
                color: categoryLabel === "CS" ? "#1e40af" : 
                       categoryLabel === "협업" ? "#166534" : "#6b21a8",
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: "12px",
                fontWeight: 700,
                marginBottom: 16
              }}>
                {categoryLabel}
              </div>
            )}
            <p style={{ 
              fontWeight: 600, 
              fontSize: "18px",
              marginBottom: 24,
              lineHeight: 1.6,
              color: "#111827"
            }}>
              {currentQuestion.question_text}
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {(["A", "B", "C"] as const).map((choiceKey) => {
                const choice =
                  choiceKey === "A" ? currentQuestion.option_a : 
                  choiceKey === "B" ? currentQuestion.option_b : 
                  currentQuestion.option_c
                const isSelected = answers[currentQuestion.id] === choiceKey;
                return (
                  <button
                    key={choiceKey}
                    onClick={() => handleSelect(currentQuestion.id, choiceKey)}
                    style={{
                      textAlign: "left",
                      padding: "16px 20px",
                      borderRadius: 10,
                      border: isSelected ? "2px solid #667eea" : "2px solid #e5e7eb",
                      background: isSelected ? "#f5f3ff" : "white",
                      color: isSelected ? "#5b21b6" : "#374151",
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: "15px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      gap: 12,
                      alignItems: "center"
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: isSelected ? "#667eea" : "#e5e7eb",
                      color: isSelected ? "white" : "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "14px",
                      flexShrink: 0
                    }}>
                      {choiceKey}
                    </div>
                    <span>{choice}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ 
            background: "white",
            padding: 32,
            borderRadius: 12,
            textAlign: "center",
            color: "#6b7280"
          }}>
            문항을 불러오는 중입니다...
          </div>
        )}

        <div style={{ 
          background: "white",
          borderRadius: 12,
          padding: 16,
          display: "flex", 
          gap: 12,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          flexWrap: "wrap"
        }}>
          <button
            onClick={() => setCurrentIndex((v) => Math.max(0, v - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "2px solid #e5e7eb",
              background: currentIndex === 0 ? "#f9fafb" : "white",
              color: currentIndex === 0 ? "#9ca3af" : "#374151",
              fontWeight: 600,
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }}
          >
            이전
          </button>
          <button
            onClick={() => setCurrentIndex((v) => Math.min(questions.length - 1, v + 1))}
            disabled={currentIndex >= questions.length - 1}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "2px solid #e5e7eb",
              background: currentIndex >= questions.length - 1 ? "#f9fafb" : "white",
              color: currentIndex >= questions.length - 1 ? "#9ca3af" : "#374151",
              fontWeight: 600,
              cursor: currentIndex >= questions.length - 1 ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }}
          >
            다음
          </button>
          <div style={{ flex: 1, minWidth: 100 }} />
          <button
            onClick={handleSubmit}
            disabled={status === "submitting" || !attempt}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              background: status === "submitting" || !attempt 
                ? "#d1d5db" 
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: "16px",
              cursor: status === "submitting" || !attempt ? "not-allowed" : "pointer",
              boxShadow: status === "submitting" || !attempt 
                ? "none" 
                : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s"
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
              padding: 24,
              marginTop: 20,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
            }}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: "24px", fontWeight: 700 }}>시험 결과</h2>
            
            <div style={{ 
              background: "#f9fafb", 
              borderRadius: 8, 
              padding: 20, 
              marginBottom: 24,
              textAlign: "center"
            }}>
              <div style={{ fontSize: "48px", fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                {result.score}점
              </div>
              <div style={{ color: "#6b7280", fontSize: "16px" }}>
                정답: {result.correct} / {result.total}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 600 }}>역량별 분석</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  { label: "CS 역량", score: result.cs_score, total: 10, color: "#3b82f6" },
                  { label: "협업 역량", score: result.collab_score, total: 10, color: "#10b981" },
                  { label: "AI 역량", score: result.ai_score, total: 10, color: "#8b5cf6" },
                ].map((item) => {
                  const percentage = (item.score / item.total) * 100;
                  return (
                    <div key={item.label}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        marginBottom: 6,
                        fontSize: "14px",
                        fontWeight: 600
                      }}>
                        <span>{item.label}</span>
                        <span>{item.score} / {item.total}</span>
                      </div>
                      <div style={{ 
                        width: "100%", 
                        height: 12, 
                        background: "#e5e7eb", 
                        borderRadius: 6, 
                        overflow: "hidden" 
                      }}>
                        <div style={{ 
                          width: `${percentage}%`, 
                          height: "100%", 
                          background: item.color,
                          transition: "width 0.3s ease"
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ 
              background: "#f0fdf4", 
              border: "1px solid #bbf7d0", 
              borderRadius: 8, 
              padding: 16,
              marginBottom: 16 
            }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "#166534" }}>
                요약
              </h3>
              <p style={{ margin: 0, color: "#15803d", lineHeight: 1.6 }}>{result.report.summary}</p>
            </div>

            {result.report.strengths.length > 0 && (
              <div style={{ 
                background: "#eff6ff", 
                border: "1px solid #bfdbfe", 
                borderRadius: 8, 
                padding: 16,
                marginBottom: 16 
              }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "#1e40af" }}>
                  강점
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#1e40af" }}>
                  {result.report.strengths.map((item, index) => (
                    <li key={`${item}-${index}`} style={{ marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.report.weaknesses.length > 0 && (
              <div style={{ 
                background: "#fef2f2", 
                border: "1px solid #fecaca", 
                borderRadius: 8, 
                padding: 16,
                marginBottom: 16 
              }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "#991b1b" }}>
                  보완이 필요한 부분
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#991b1b" }}>
                  {result.report.weaknesses.map((item, index) => (
                    <li key={`${item}-${index}`} style={{ marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.report.recommendations.length > 0 && (
              <div style={{ 
                background: "#fefce8", 
                border: "1px solid #fde047", 
                borderRadius: 8, 
                padding: 16 
              }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600, color: "#854d0e" }}>
                  추천 사항
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#854d0e" }}>
                  {result.report.recommendations.map((item, index) => (
                    <li key={`${item}-${index}`} style={{ marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
