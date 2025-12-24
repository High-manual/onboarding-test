"use client";

import { useEffect, useState } from "react";

interface AttemptRow {
  id: string;
  student_id: string;
  score: number | null;
  cs_score: number | null;
  collab_score: number | null;
  ai_score: number | null;
  created_at: string;
  submitted_at: string | null;
  students?: { name: string | null };
}

interface TeamMember {
  student_id: string;
  student_name: string;
  score: number;
}

interface Team {
  team_number: number;
  members: TeamMember[];
}

export default function AdminAttemptsPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [numTeams, setNumTeams] = useState(4);
  const [matchingMode, setMatchingMode] = useState<"rank" | "balanced">("rank");
  const [message, setMessage] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showTeams, setShowTeams] = useState(false);

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
    setShowTeams(false);

    // 제출한 학생만 필터링
    const submittedAttempts = attempts.filter(a => a.score !== null && a.submitted_at);
    
    if (submittedAttempts.length === 0) {
      setError("제출한 학생이 없습니다.");
      return;
    }

    if (numTeams < 1 || numTeams > submittedAttempts.length) {
      setError(`팀 수는 1부터 ${submittedAttempts.length} 사이여야 합니다.`);
      return;
    }

    const teamSize = Math.ceil(submittedAttempts.length / numTeams);

    const response = await fetch("/api/admin/team-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamSize, mode: matchingMode }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "팀 매칭 실패");
      return;
    }
    
    // 팀 매칭 결과 표시
    const generatedTeams: Team[] = [];
    for (let i = 0; i < numTeams; i++) {
      generatedTeams.push({ team_number: i + 1, members: [] });
    }

    const sortedAttempts = [...submittedAttempts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    
    if (matchingMode === "rank") {
      // 라운드로빈 방식으로 팀 배정
      sortedAttempts.forEach((attempt, index) => {
        const teamIndex = index % numTeams;
        generatedTeams[teamIndex].members.push({
          student_id: attempt.student_id,
          student_name: attempt.students?.name ?? "익명",
          score: attempt.score ?? 0
        });
      });
    } else {
      // 역량 균형 방식 (지그재그)
      let teamIndex = 0;
      let direction = 1;
      sortedAttempts.forEach((attempt) => {
        generatedTeams[teamIndex].members.push({
          student_id: attempt.student_id,
          student_name: attempt.students?.name ?? "익명",
          score: attempt.score ?? 0
        });
        teamIndex += direction;
        if (teamIndex >= numTeams) {
          teamIndex = numTeams - 1;
          direction = -1;
        } else if (teamIndex < 0) {
          teamIndex = 0;
          direction = 1;
        }
      });
    }

    setTeams(generatedTeams);
    setShowTeams(true);
    const modeLabel = matchingMode === "balanced" ? "역량 균형" : "점수 순";
    setMessage(`팀 매칭 생성 완료 (${numTeams}개 팀, 방식: ${modeLabel})`);
  };

  const moveStudent = (fromTeam: number, toTeam: number, studentId: string) => {
    const newTeams = [...teams];
    const fromTeamData = newTeams.find(t => t.team_number === fromTeam);
    const toTeamData = newTeams.find(t => t.team_number === toTeam);
    
    if (!fromTeamData || !toTeamData) return;
    
    const memberIndex = fromTeamData.members.findIndex(m => m.student_id === studentId);
    if (memberIndex === -1) return;
    
    const member = fromTeamData.members[memberIndex];
    fromTeamData.members.splice(memberIndex, 1);
    toTeamData.members.push(member);
    
    setTeams(newTeams);
    setMessage("팀 편성이 수정되었습니다.");
  };

  return (
    <main style={{ 
      minHeight: "100vh",
      background: "#f9fafb",
      padding: "24px 16px"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ 
          background: "white",
          borderRadius: 12,
          padding: 24,
          marginBottom: 20,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: "28px", margin: 0, fontWeight: 700 }}>관리자 - 응시 현황</h1>
            <p style={{ color: "#6b7280", marginTop: 4, margin: 0 }}>
              제출 완료: {attempts.filter(a => a.submitted_at).length}명 / 전체: {attempts.length}명
            </p>
          </div>

          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 12, 
            flexWrap: "wrap",
            padding: 16,
            background: "#f9fafb",
            borderRadius: 8
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontWeight: 600, fontSize: "14px" }}>팀 개수:</label>
              <input
                type="number"
                min={1}
                value={numTeams}
                onChange={(e) => setNumTeams(Number(e.target.value))}
                style={{ 
                  width: 80, 
                  padding: "8px 12px", 
                  borderRadius: 6, 
                  border: "2px solid #e5e7eb",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontWeight: 600, fontSize: "14px" }}>매칭 방식:</label>
              <select
                value={matchingMode}
                onChange={(e) => setMatchingMode(e.target.value as "rank" | "balanced")}
                style={{ 
                  padding: "8px 12px", 
                  borderRadius: 6, 
                  border: "2px solid #e5e7eb",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                <option value="rank">점수 순 (라운드로빈)</option>
                <option value="balanced">역량 균형 (지그재그)</option>
              </select>
            </div>
            <button
              onClick={handleTeamRun}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
              }}
            >
              팀 매칭 생성
            </button>
          </div>

          {error && (
            <div style={{ 
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              padding: 12,
              borderRadius: 8,
              marginTop: 12
            }}>
              {error}
            </div>
          )}
          {message && (
            <div style={{ 
              color: "#166534",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              padding: 12,
              borderRadius: 8,
              marginTop: 12
            }}>
              {message}
            </div>
          )}
        </header>

        {showTeams && teams.length > 0 && (
          <div style={{ 
            background: "white",
            borderRadius: 12,
            padding: 24,
            marginBottom: 20,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "22px", fontWeight: 700 }}>팀 매칭 결과</h2>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {teams.map((team) => {
                const avgScore = team.members.length > 0
                  ? (team.members.reduce((sum, m) => sum + m.score, 0) / team.members.length).toFixed(1)
                  : "0";
                return (
                  <div key={team.team_number} style={{
                    border: "2px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 16,
                    background: "#fafafa"
                  }}>
                    <div style={{ 
                      marginBottom: 12, 
                      display: "flex", 
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                        팀 {team.team_number}
                      </h3>
                      <span style={{ 
                        fontSize: "14px", 
                        color: "#6b7280",
                        background: "#fff",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontWeight: 600
                      }}>
                        평균: {avgScore}점
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {team.members.map((member) => (
                        <div key={member.student_id} style={{
                          background: "white",
                          padding: "10px 12px",
                          borderRadius: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: "1px solid #e5e7eb"
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{member.student_name}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>{member.score}점</div>
                          </div>
                          <select
                            onChange={(e) => {
                              const toTeam = Number(e.target.value);
                              if (toTeam !== team.team_number) {
                                moveStudent(team.team_number, toTeam, member.student_id);
                              }
                              e.target.value = String(team.team_number);
                            }}
                            defaultValue={team.team_number}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              fontSize: "12px",
                              cursor: "pointer"
                            }}
                          >
                            {teams.map(t => (
                              <option key={t.team_number} value={t.team_number}>
                                팀 {t.team_number}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      {team.members.length === 0 && (
                        <div style={{ 
                          color: "#9ca3af", 
                          fontSize: "14px", 
                          textAlign: "center",
                          padding: 12
                        }}>
                          팀원 없음
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ 
          background: "white",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 700 }}>전체 응시 목록</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>이름</th>
                  <th style={thStyle}>총점</th>
                  <th style={thStyle}>CS</th>
                  <th style={thStyle}>협업</th>
                  <th style={thStyle}>AI</th>
                  <th style={thStyle}>제출 시간</th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                      응시 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  attempts.map((attempt) => (
                    <tr key={attempt.id} style={{ 
                      background: attempt.submitted_at ? "white" : "#fef9c3" 
                    }}>
                      <td style={tdStyle}>{attempt.students?.name ?? "익명"}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{attempt.score ?? "-"}</td>
                      <td style={tdStyle}>{attempt.cs_score ?? "-"}</td>
                      <td style={tdStyle}>{attempt.collab_score ?? "-"}</td>
                      <td style={tdStyle}>{attempt.ai_score ?? "-"}</td>
                      <td style={tdStyle}>
                        {attempt.submitted_at 
                          ? new Date(attempt.submitted_at).toLocaleString("ko-KR") 
                          : "미제출"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  borderBottom: "2px solid #e5e7eb",
  fontSize: "14px",
  fontWeight: 700,
  color: "#374151"
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #f3f4f6",
  fontSize: "14px",
  color: "#111827"
};
