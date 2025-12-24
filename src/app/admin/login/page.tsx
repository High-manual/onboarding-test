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
    <main style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}>
      <div style={{ 
        maxWidth: 480, 
        width: "100%",
        background: "white",
        borderRadius: 16,
        padding: "40px 32px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: "32px",
            color: "white"
          }}>
            🔐
          </div>
          <h1 style={{ 
            fontSize: "28px", 
            fontWeight: 800, 
            marginBottom: 8,
            color: "#111827"
          }}>
            관리자 로그인
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            응시 현황 및 팀 매칭 관리
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: "14px", color: "#374151" }}>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            style={{
              background: loading 
                ? "#d1d5db" 
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 24px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "16px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading 
                ? "none" 
                : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s"
            }}
          >
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
