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
      id: authData.user.id,
      display_name: displayName.trim(),
    });

    if (studentError) {
      setError(studentError.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/exam");
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: "28px", marginBottom: 8 }}>익명 로그인으로 시험 시작</h1>
      <p style={{ marginBottom: 24, color: "#4b5563" }}>
        이름만 입력하면 익명 계정이 생성됩니다. 이후 모든 데이터는 RLS로 본인만 조회할 수 있습니다.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>이름</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="홍길동"
            required
            style={{
              padding: "12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 16,
            }}
          />
        </label>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            background: "#111827",
            color: "white",
            padding: "12px 16px",
            borderRadius: 8,
            fontWeight: 700,
            border: "none",
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? "처리 중..." : "시험 시작하기"}
        </button>
      </form>
    </main>
  );
}
