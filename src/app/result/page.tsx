"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Attempt, Question } from "@/lib/types";

interface ResultItem {
  question: Question;
  selected: "A" | "B" | "C" | "D" | "X";
  isCorrect: boolean;
}

interface ResultData {
  attempt: Attempt;
  result: ResultItem[];
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

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

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

    const attemptId = searchParams.get("attemptId");
    if (!attemptId) {
      setError("응시 ID가 없습니다.");
      setLoading(false);
      return;
    }

    const loadResult = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/result?attemptId=${attemptId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });

        const json = await response.json();

        if (!response.ok) {
          setError(json.error ?? "결과를 불러오는데 실패했습니다.");
          setLoading(false);
          return;
        }

        setResultData(json);
      } catch (err) {
        setError("결과를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [sessionToken, searchParams]);

  if (!sessionToken || loading) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 16px" }}>
        <p>로딩 중...</p>
      </main>
    );
  }

  if (error || !resultData) {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 16px" }}>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: 16,
            borderRadius: 12,
          }}
        >
          {error ?? "결과를 찾을 수 없습니다."}
        </div>
      </main>
    );
  }

  const { attempt, result } = resultData;
  const total = result.length;
  const correct = result.filter((r) => r.isCorrect).length;
  const score = attempt.score ?? 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <header
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
        >
          <h1 style={{ fontSize: "28px", margin: 0, fontWeight: 700 }}>
            시험 결과
          </h1>
        </header>

        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 24,
            marginBottom: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
        >
          <div
            style={{
              background: "#f9fafb",
              borderRadius: 8,
              padding: 20,
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: "#111827",
                marginBottom: 8,
              }}
            >
              {score}점
            </div>
            <div style={{ color: "#6b7280", fontSize: "16px" }}>
              정답: {correct} / {total}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 600 }}>
              역량별 분석
            </h3>

            <div style={{ display: "grid", gap: 12 }}>
              {[
                { label: "CS 역량", score: attempt.cs_score ?? 0, total: 15, color: "#3b82f6" },
                { label: "협업 역량", score: attempt.collab_score ?? 0, total: 15, color: "#10b981" },
                { label: "AI 역량", score: attempt.ai_score ?? 0, total: 20, color: "#8b5cf6" },
              ].map((item) => {
                const percentage = (item.score / item.total) * 100;
                return (
                  <div key={item.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      <span>{item.label}</span>
                      <span>
                        {item.score} / {item.total}
                      </span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: 12,
                        background: "#e5e7eb",
                        borderRadius: 6,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          background: item.color,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              width: "100%",
              padding: "12px 24px",
              borderRadius: 8,
              background: showDetails ? "#d1d5db" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: "16px",
              cursor: "pointer",
              boxShadow: showDetails ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s",
            }}
          >
            {showDetails ? "자세히 보기 닫기" : "각 문항과 정답 자세히 보기"}
          </button>
        </div>

        {showDetails && (
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            }}
          >
            <h2 style={{ margin: "0 0 24px", fontSize: "24px", fontWeight: 700 }}>
              문항별 상세 결과
            </h2>

            <div style={{ display: "grid", gap: 24 }}>
              {result.map((item, index) => {
                const { question, selected, isCorrect } = item;
                const categoryLabel = getCategoryLabel(question.category);

                return (
                  <div
                    key={question.id}
                    style={{
                      border: `2px solid ${isCorrect ? "#10b981" : "#ef4444"}`,
                      borderRadius: 12,
                      padding: 20,
                      background: isCorrect ? "#f0fdf4" : "#fef2f2",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div
                          style={{
                            background: isCorrect ? "#10b981" : "#ef4444",
                            color: "white",
                            padding: "4px 12px",
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: "14px",
                          }}
                        >
                          {index + 1}번
                        </div>
                        {categoryLabel && (
                          <div
                            style={{
                              display: "inline-block",
                              background:
                                categoryLabel === "CS"
                                  ? "#eff6ff"
                                  : categoryLabel === "협업"
                                  ? "#f0fdf4"
                                  : "#faf5ff",
                              color:
                                categoryLabel === "CS"
                                  ? "#1e40af"
                                  : categoryLabel === "협업"
                                  ? "#166534"
                                  : "#6b21a8",
                              padding: "4px 12px",
                              borderRadius: 6,
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {categoryLabel}
                          </div>
                        )}
                        {selected === "X" && (
                          <div
                            style={{
                              background: "#6b7280",
                              color: "white",
                              padding: "4px 12px",
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: "14px",
                            }}
                          >
                            미답변
                          </div>
                        )}
                        <div
                          style={{
                            background: isCorrect ? "#10b981" : "#ef4444",
                            color: "white",
                            padding: "4px 12px",
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: "14px",
                          }}
                        >
                          {isCorrect ? "정답" : "오답"}
                        </div>
                      </div>
                    </div>

                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: "16px",
                        marginBottom: 20,
                        lineHeight: 1.6,
                        color: "#111827",
                      }}
                    >
                      {question.question_text}
                    </p>

                    {selected === "X" && (
                      <div
                        style={{
                          background: "#fef2f2",
                          border: "2px solid #ef4444",
                          color: "#991b1b",
                          padding: "12px 16px",
                          borderRadius: 8,
                          marginBottom: 20,
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        미답변
                      </div>
                    )}

                    <div style={{ display: "grid", gap: 10 }}>
                      {(["A", "B", "C", "D"] as const).map((choiceKey) => {
                        const choice =
                          choiceKey === "A"
                            ? question.option_a
                            : choiceKey === "B"
                            ? question.option_b
                            : choiceKey === "C"
                            ? question.option_c
                            : question.option_d;

                        const isSelected = selected === choiceKey;
                        const isCorrectAnswer = question.correct_answer === choiceKey;

                        let borderColor = "#e5e7eb";
                        let background = "white";
                        let textColor = "#374151";

                        if (isCorrectAnswer) {
                          borderColor = "#10b981";
                          background = "#f0fdf4";
                          textColor = "#166534";
                        } else if (isSelected && !isCorrectAnswer) {
                          borderColor = "#ef4444";
                          background = "#fef2f2";
                          textColor = "#991b1b";
                        }

                        return (
                          <div
                            key={choiceKey}
                            style={{
                              padding: "12px 16px",
                              borderRadius: 8,
                              border: `2px solid ${borderColor}`,
                              background,
                              color: textColor,
                              fontWeight: isCorrectAnswer || isSelected ? 600 : 400,
                              fontSize: "14px",
                              display: "flex",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: isCorrectAnswer
                                  ? "#10b981"
                                  : isSelected
                                  ? "#ef4444"
                                  : "#e5e7eb",
                                color: isCorrectAnswer || isSelected ? "white" : "#6b7280",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "12px",
                                flexShrink: 0,
                              }}
                            >
                              {choiceKey}
                            </div>
                            <span>{choice}</span>
                            {isCorrectAnswer && (
                              <span
                                style={{
                                  marginLeft: "auto",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#10b981",
                                }}
                              >
                                정답
                              </span>
                            )}
                            {isSelected && !isCorrectAnswer && (
                              <span
                                style={{
                                  marginLeft: "auto",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#ef4444",
                                }}
                              >
                                선택한 답
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 16px" }}>
          <p>로딩 중...</p>
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}

