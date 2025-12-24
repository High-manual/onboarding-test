"use client";

import { useEffect, useState } from "react";

interface AttemptRow {
  id: string;
  student_id: string;
  status: string;
  total_score: number | null;
  cs_score: number | null;
  collab_score: number | null;
  ai_score: number | null;
  created_at: string;
  submitted_at: string | null;
  students?: { display_name: string | null };
}

export default function AdminAttemptsPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState(3);
  const [message, setMessage] = useState<string | null>(null);

  const loadAttempts = async () => {
    const response = await fetch("/api/admin/attempts");
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "불러오기 실패");
      return;
    }
    setAttempts(json.attempts ?? []);
  };

  useEffect(() => {
    loadAttempts();
  }, []);

  const handleTeamRun = async () => {
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/team-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamCount }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "팀 매칭 실패");
      return;
    }
    setMessage(`팀 매칭 생성 완료 (팀 수: ${json.teamRun.team_count})`);
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: "28px", margin: 0 }}>관리자 - 응시 현황</h1>
          <p style={{ color: "#4b5563", marginTop: 4 }}>서비스 롤 키로 전체 데이터를 조회합니다.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={1}
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
            style={{ width: 80, padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
          />
          <button
            onClick={handleTeamRun}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#111827",
              color: "white",
              border: "none",
              fontWeight: 700,
            }}
          >
            팀 매칭 실행
          </button>
        </div>
      </header>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {message && <p style={{ color: "#065f46" }}>{message}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>이름</th>
              <th style={thStyle}>총점</th>
              <th style={thStyle}>CS</th>
              <th style={thStyle}>협업</th>
              <th style={thStyle}>AI</th>
              <th style={thStyle}>상태</th>
              <th style={thStyle}>제출</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={attempt.id}>
                <td style={tdStyle}>{attempt.students?.display_name ?? "익명"}</td>
                <td style={tdStyle}>{attempt.total_score ?? "-"}</td>
                <td style={tdStyle}>{attempt.cs_score ?? "-"}</td>
                <td style={tdStyle}>{attempt.collab_score ?? "-"}</td>
                <td style={tdStyle}>{attempt.ai_score ?? "-"}</td>
                <td style={tdStyle}>{attempt.status}</td>
                <td style={tdStyle}>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "1px solid #f3f4f6",
};
