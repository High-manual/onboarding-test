"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "로그인 실패");
      setLoading(false);
      return;
    }

    router.push("/admin/attempts");
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: "28px", marginBottom: 12 }}>관리자 로그인</h1>
      <p style={{ color: "#4b5563", marginBottom: 16 }}>서버 환경변수 ADMIN_PASSWORD와 비교합니다.</p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: 12, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 16 }}
          />
        </label>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#111827",
            color: "white",
            padding: "12px 16px",
            borderRadius: 8,
            fontWeight: 700,
            border: "none",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "확인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
