"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Attempt, Question } from "@/lib/types";

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

const VALID_CHOICES = ["A", "B", "C", "D", "E", "X"] as const;
const TIME_PER_QUESTION = 20;

export default function ExamPage() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D" | "E" | "X">>({});
  const [status, setStatus] = useState<"idle" | "loading" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timeoutHandledRef = useRef(false);
  const indexRestoredRef = useRef(false);
  const answersInitializedRef = useRef(false);

  // 제출 로직 통합
  const submitExam = useCallback(
    async (errorMessage = "제출에 실패했습니다.") => {
      if (!attempt || !sessionToken || !questions.length) return;

      setStatus("submitting");
      setError(null);

      const payload = {
        attemptId: attempt.id,
        responses: questions.map((q) => ({
          questionId: q.id,
          selected: (answers[q.id] || "X") as "A" | "B" | "C" | "D" | "E" | "X",
        })),
      };

      try {
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
          setError(json.error ?? errorMessage);
          setStatus("idle");
          return;
        }

        // 제출 성공 시 localStorage 정리
        localStorage.removeItem("exam_answers");
        localStorage.removeItem("exam_current_index");
        setIsTimerActive(false);
        router.push(`/result?attemptId=${attempt.id}`);
      } catch (err) {
        setError(errorMessage);
        setStatus("idle");
      }
    },
    [attempt, sessionToken, questions, answers, router]
  );

  // 초기화: localStorage에서 답변 및 인덱스 복원
  useEffect(() => {
    const savedAnswers = localStorage.getItem("exam_answers");
    if (savedAnswers) {
      try {
        const parsed = JSON.parse(savedAnswers);
        const validAnswers: Record<string, "A" | "B" | "C" | "D" | "E" | "X"> = {};
        Object.entries(parsed).forEach(([key, value]) => {
          if (VALID_CHOICES.includes(value as any)) {
            validAnswers[key] = value as "A" | "B" | "C" | "D" | "E" | "X";
          }
        });
        setAnswers(validAnswers);
      } catch (e) {
        console.error("Failed to parse saved answers:", e);
      }
    }
    answersInitializedRef.current = true;
  }, []);

  // 세션 확인
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

  // 데이터 로드: questions와 attempt
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

  // questions 로드 후 currentIndex 복원 (한 번만)
  useEffect(() => {
    if (questions.length === 0 || indexRestoredRef.current) return;

    const savedIndex = localStorage.getItem("exam_current_index");
    if (savedIndex) {
      try {
        const parsedIndex = parseInt(savedIndex, 10);
        if (parsedIndex >= 0 && parsedIndex < questions.length) {
          setCurrentIndex(parsedIndex);
        } else {
          setCurrentIndex(0);
          localStorage.setItem("exam_current_index", "0");
        }
      } catch (e) {
        console.error("Failed to parse saved index:", e);
        setCurrentIndex(0);
      }
    }
    indexRestoredRef.current = true;
  }, [questions.length]);

  // localStorage 동기화 (answers 변경 시)
  useEffect(() => {
    if (questions.length === 0 || status !== "idle" || !answersInitializedRef.current) return;
    localStorage.setItem("exam_answers", JSON.stringify(answers));
  }, [answers, questions.length, status]);

  // localStorage 동기화 및 타이머 관리 (currentIndex 변경 시)
  useEffect(() => {
    if (questions.length === 0 || status !== "idle") return;

    localStorage.setItem("exam_current_index", currentIndex.toString());

    // 타이머 리셋 및 시작
    setTimeLeft(TIME_PER_QUESTION);
    setIsTimerActive(true);
    timeoutHandledRef.current = false;
  }, [currentIndex, questions.length, status]);

  // 타이머 로직
  useEffect(() => {
    if (!isTimerActive || status !== "idle") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerActive, status]);

  // 시간 초과 처리
  useEffect(() => {
    if (timeLeft !== 0 || !isTimerActive || status !== "idle" || questions.length === 0) return;
    if (timeoutHandledRef.current) return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    timeoutHandledRef.current = true;
    setIsTimerActive(false);

    // 현재 문제가 답변되지 않았으면 X로 표시
    const currentQuestionId = currentQ.id;
    setAnswers((prev) => {
      if (prev[currentQuestionId]) return prev;
      return { ...prev, [currentQuestionId]: "X" };
    });

    // 마지막 문제가 아닌 경우 다음 문제로 이동
    if (currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex((v) => v + 1), 100);
    } else {
      // 마지막 문제에서 시간 초과 시 자동 제출
      submitExam("시간 초과로 인한 자동 제출에 실패했습니다.");
    }
  }, [timeLeft, isTimerActive, status, currentIndex, questions, submitExam]);

  const handleSelect = (questionId: string, selected: "A" | "B" | "C" | "D" | "E") => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
  };

  const handleSubmit = async () => {
    if (!isAllAnswered) return;
    await submitExam();
  };

  // 계산된 값들
  const validCurrentIndex = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.max(0, Math.min(currentIndex, questions.length - 1));
  }, [currentIndex, questions.length]);

  const isAllAnswered = useMemo(() => {
    if (questions.length === 0) return false;
    return Object.keys(answers).length === questions.length;
  }, [answers, questions.length]);

  // currentIndex 범위 검증 및 수정
  useEffect(() => {
    if (questions.length > 0 && currentIndex >= questions.length) {
      setCurrentIndex(0);
      localStorage.setItem("exam_current_index", "0");
    }
  }, [currentIndex, questions.length]);

  const currentQuestion = questions[validCurrentIndex];
  const progressText = questions.length > 0 
    ? `${validCurrentIndex + 1} / ${questions.length}`
    : "0 / 0";
  const categoryLabel = currentQuestion ? getCategoryLabel(currentQuestion.category) : null;
  
  // 답을 입력해야지만 다음으로 넘길 수 있음
  const isCurrentAnswered = currentQuestion
    ? !!answers[currentQuestion.id]
    : false;

  if (!sessionToken) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
        <p>세션 확인 중...</p>
      </main>
    );
  }

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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
        >
          <div>
            <h1 style={{ fontSize: "28px", margin: 0, fontWeight: 700 }}>
              프로젝트 역량 평가
            </h1>
            <p style={{ color: "#6b7280", marginTop: 4, margin: 0 }}>총 50문항</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                background: timeLeft <= 5 ? "#ef4444" : "#10b981",
                color: "white",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "18px",
                minWidth: 60,
                textAlign: "center",
                transition: "background 0.3s",
              }}
            >
              {timeLeft}초
            </div>
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "18px",
              }}
            >
              {progressText}
            </div>
          </div>
        </header>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: 16,
              borderRadius: 12,
              marginBottom: 20,
            }}
          >
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
                  marginBottom: 16,
                }}
              >
                {categoryLabel}
              </div>
            )}

            <p
              style={{
                fontWeight: 600,
                fontSize: "18px",
                marginBottom: 24,
                lineHeight: 1.6,
                color: "#111827",
              }}
            >
              {currentQuestion.question_text}
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              {(["A", "B", "C", "D", "E"] as const).map((choiceKey) => {
                const choice =
                  choiceKey === "A"
                    ? currentQuestion.option_a
                    : choiceKey === "B"
                    ? currentQuestion.option_b
                    : choiceKey === "C"
                    ? currentQuestion.option_c
                    : choiceKey === "D"
                    ? currentQuestion.option_d
                    : currentQuestion.option_e;

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
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
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
                        flexShrink: 0,
                      }}
                    >
                      {choiceKey}
                    </div>
                    <span>{choice}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "white",
              padding: 32,
              borderRadius: 12,
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            문항을 불러오는 중입니다...
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            gap: 12,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() =>
              setCurrentIndex((v) => Math.min(questions.length - 1, v + 1))
            }
            disabled={
              currentIndex >= questions.length - 1 || !isCurrentAnswered
            }
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              border: "2px solid #e5e7eb",
              background:
                currentIndex >= questions.length - 1 || !isCurrentAnswered
                  ? "#f9fafb"
                  : "white",
              color:
                currentIndex >= questions.length - 1 || !isCurrentAnswered
                  ? "#9ca3af"
                  : "#374151",
              fontWeight: 600,
              cursor:
                currentIndex >= questions.length - 1 || !isCurrentAnswered
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.2s",
            }}
          >
            다음
          </button>

          <div style={{ flex: 1, minWidth: 100 }} />

          <button
            onClick={handleSubmit}
            disabled={status === "submitting" || !attempt || !isAllAnswered}
            style={{
              padding: "12px 24px",
              borderRadius: 8,
              background:
                status === "submitting" || !attempt || !isAllAnswered
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: "16px",
              cursor:
                status === "submitting" || !attempt || !isAllAnswered
                  ? "not-allowed"
                  : "pointer",
              boxShadow:
                status === "submitting" || !attempt || !isAllAnswered
                  ? "none"
                  : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s",
            }}
          >
            {status === "submitting" ? "채점 중..." : "제출하기"}
          </button>
        </div>

      </div>
    </main>
  );
}
