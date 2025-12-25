"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function ExamPage() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D" | "X">>(
    {}
  );
  const [status, setStatus] = useState<"idle" | "loading" | "submitting" | "done">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1080); // 18분 = 1080초
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);

  // localStorage에서 답변 및 시간 복원
  useEffect(() => {
    const savedAnswers = localStorage.getItem("exam_answers");
    const savedIndex = localStorage.getItem("exam_current_index");
    const savedTime = localStorage.getItem("exam_time_left");
    const savedStartTime = localStorage.getItem("exam_start_time");
    
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
      } catch (e) {
        console.error("Failed to parse saved answers:", e);
      }
    }
    
    if (savedIndex) {
      try {
        setCurrentIndex(parseInt(savedIndex, 10));
      } catch (e) {
        console.error("Failed to parse saved index:", e);
      }
    }

    // 시간 복원: 시작 시간이 있으면 경과 시간 계산, 없으면 저장된 시간 사용
    if (savedStartTime) {
      try {
        const startTime = parseInt(savedStartTime, 10);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 1080 - elapsed);
        setTimeLeft(remaining);
      } catch (e) {
        console.error("Failed to parse saved start time:", e);
      }
    } else if (savedTime) {
      try {
        setTimeLeft(parseInt(savedTime, 10));
      } catch (e) {
        console.error("Failed to parse saved time:", e);
      }
    }
    
    setIsInitialized(true);
  }, []);

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

  // 답변 변경 시 localStorage에 저장
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("exam_answers", JSON.stringify(answers));
    }
  }, [answers, isInitialized]);

  // 현재 문제 인덱스 변경 시 localStorage에 저장
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("exam_current_index", currentIndex.toString());
    }
  }, [currentIndex, isInitialized]);

  // 시험 시작 시 타이머 시작
  useEffect(() => {
    if (questions.length > 0 && attempt && !isTimerActive && status === "idle") {
      const savedStartTime = localStorage.getItem("exam_start_time");
      if (!savedStartTime) {
        // 처음 시작하는 경우 시작 시간 저장
        localStorage.setItem("exam_start_time", Date.now().toString());
      }
      setIsTimerActive(true);
    }
  }, [questions.length, attempt, isTimerActive, status]);

  // 시간 초과 시 자동 제출 (한 번만 실행)
  useEffect(() => {
    if (!isTimerActive || status !== "idle" || hasAutoSubmitted) return;
    if (timeLeft > 0) return;

    // 시간 초과 시 모든 미답변 문제를 X로 처리하고 자동 제출
    setIsTimerActive(false);
    setHasAutoSubmitted(true);
    
    const updatedAnswers = { ...answers };
    questions.forEach((q) => {
      if (!updatedAnswers[q.id]) {
        updatedAnswers[q.id] = "X" as "A" | "B" | "C" | "D";
      }
    });
    
    setAnswers(updatedAnswers);
    
    // 자동 제출
    if (attempt && sessionToken) {
      const payload = {
        attemptId: attempt.id,
        responses: Object.entries(updatedAnswers)
          .filter(([_, selected]) => ["A", "B", "C", "D", "X"].includes(selected))
          .map(([questionId, selected]) => ({
            questionId,
            selected: selected as "A" | "B" | "C" | "D" | "X",
          })),
      };

      fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      })
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok) {
            setError(json.error ?? "시간 초과로 인한 자동 제출에 실패했습니다.");
            setStatus("idle");
            return;
          }
          localStorage.removeItem("exam_answers");
          localStorage.removeItem("exam_current_index");
          localStorage.removeItem("exam_time_left");
          localStorage.removeItem("exam_start_time");
          // 결과 페이지로 리다이렉트
          router.push(`/result?attemptId=${attempt.id}`);
        })
        .catch((err) => {
          setError("시간 초과로 인한 자동 제출에 실패했습니다.");
          setStatus("idle");
        });
    }
  }, [timeLeft, isTimerActive, status, hasAutoSubmitted, questions, answers, attempt, sessionToken, router]);

  // 타이머 로직
  useEffect(() => {
    if (!isTimerActive || status !== "idle" || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1);
        // localStorage에 시간 저장
        if (isInitialized) {
          localStorage.setItem("exam_time_left", newTime.toString());
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerActive, status, timeLeft, isInitialized]);

  const handleSelect = (questionId: string, selected: "A" | "B" | "C" | "D") => {
    setAnswers((prev) => ({ ...prev, [questionId]: selected }));
  };

  // 답을 입력해야지만 다음으로 넘길 수 있음
  const isCurrentAnswered = questions[currentIndex]
  ? !!answers[questions[currentIndex].id]
  : false;


  // 모든 문제를 풀었을 때만 제출 가능
  const isAllAnswered = useMemo(() => {
    if (!questions.length) return false;
    return questions.every((q) => !!answers[q.id]);
  }, [questions, answers]);

  const handleSubmit = async () => {
    if (!attempt || !sessionToken) return;
    if (!isAllAnswered) return;

    setStatus("submitting");
    setError(null);

    const payload = {
      attemptId: attempt.id,
      responses: Object.entries(answers)
        .filter(([_, selected]) => ["A", "B", "C", "D", "X"].includes(selected))
        .map(([questionId, selected]) => ({
          questionId,
          selected: selected as "A" | "B" | "C" | "D" | "X",
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

    // 제출 성공 시 localStorage 정리
    localStorage.removeItem("exam_answers");
    localStorage.removeItem("exam_current_index");
    localStorage.removeItem("exam_time_left");
    localStorage.removeItem("exam_start_time");
    setIsTimerActive(false);

    // 결과 페이지로 리다이렉트
    router.push(`/result?attemptId=${attempt.id}`);
  };

  const currentQuestion = questions[currentIndex];
  const progressText = `${currentIndex + 1} / ${questions.length || 1}`;
  const categoryLabel = currentQuestion ? getCategoryLabel(currentQuestion.category) : null;
  
  // 시간을 분:초 형식으로 변환
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
                background: timeLeft <= 60 ? "#ef4444" : timeLeft <= 300 ? "#f59e0b" : "#10b981",
                color: "white",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "18px",
                minWidth: 80,
                textAlign: "center",
                transition: "background 0.3s",
              }}
            >
              {formatTime(timeLeft)}
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
              {(["A", "B", "C", "D"] as const).map((choiceKey) => {
                const choice =
                  choiceKey === "A"
                    ? currentQuestion.option_a
                    : choiceKey === "B"
                    ? currentQuestion.option_b
                    : choiceKey === "C"
                    ? currentQuestion.option_c
                    : currentQuestion.option_d;

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
              transition: "all 0.2s",
            }}
          >
            이전
          </button>

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
