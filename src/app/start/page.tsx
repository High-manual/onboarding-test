"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

export default function StartPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!displayName.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    const supabase = getBrowserSupabaseClient();

    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError || !authData.user) {
      setError(authError?.message ?? "로그인에 실패했습니다.");
      setIsSubmitting(false);
      return;
    }

    const { error: studentError } = await supabase.from("students").upsert({
      user_id: authData.user.id,
      name: displayName.trim(),
    });

    if (studentError) {
      setError(studentError.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/exam");
  };

  return (
    <main style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      <div style={{ 
        maxWidth: 520, 
        width: "100%",
        background: "white",
        borderRadius: 16,
        padding: "40px 32px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ 
            fontSize: "32px", 
            fontWeight: 800, 
            marginBottom: 12,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            시험 시작
          </h1>
          <p style={{ color: "#6b7280", lineHeight: 1.6, fontSize: "15px" }}>
            이름을 입력하고 프로젝트 역량 평가를 시작하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: "14px", color: "#374151" }}>이름</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="홍길동"
              required
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "2px solid #e5e7eb",
                fontSize: "16px",
                transition: "all 0.2s",
                outline: "none"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#667eea";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e5e7eb";
              }}
            />
          </label>

          {error && (
            <div style={{ 
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              padding: 12,
              borderRadius: 8,
              fontSize: "14px"
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              background: isSubmitting 
                ? "#d1d5db" 
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 24px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "16px",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: isSubmitting 
                ? "none" 
                : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s"
            }}
          >
            {isSubmitting ? "처리 중..." : "시험 시작하기"}
          </button>
        </form>

        <div style={{ 
          marginTop: 24, 
          padding: 16,
          background: "#f9fafb",
          borderRadius: 10,
          fontSize: "13px",
          color: "#6b7280",
          lineHeight: 1.6
        }}>
          <strong style={{ color: "#374151" }}>안내사항</strong><br />
          • 총 50문항 (CS 15, 협업 15, AI 20)<br />
          • 제출 후 즉시 결과 확인 가능<br />
        </div>
      </div>
    </main>
  );
}
