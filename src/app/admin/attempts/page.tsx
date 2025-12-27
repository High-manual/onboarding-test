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
  category_stats?: {
    cs: { total: number; correct: number; pass: number; timeout: number };
    collab: { total: number; correct: number; pass: number; timeout: number };
    ai: { total: number; correct: number; pass: number; timeout: number };
  };
  timeout_count?: number;
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

const formatDateKR = (dateString: string): string => {
  const date = new Date(dateString);
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value ?? "";
  const month = parts.find(p => p.type === "month")?.value ?? "";
  const day = parts.find(p => p.type === "day")?.value ?? "";
  const hour = parts.find(p => p.type === "hour")?.value?.padStart(2, '0') ?? "";
  const minute = parts.find(p => p.type === "minute")?.value?.padStart(2, '0') ?? "";
  return `${year}.${month}.${day} ${hour}:${minute}`;
};

export default function AdminAttemptsPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [numTeams, setNumTeams] = useState(4);
  const [matchingMode, setMatchingMode] = useState<"rank" | "balanced">("rank");
  const [message, setMessage] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showTeams, setShowTeams] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedTeamSize, setSavedTeamSize] = useState<number | null>(null);
  const [savedMode, setSavedMode] = useState<"rank" | "balanced" | null>(null);

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
    loadSavedTeams();
  }, []);

  const loadSavedTeams = async () => {
    const response = await fetch("/api/admin/teams");
    const json = await response.json();
    if (response.ok && json.teams) {
      const loadedTeams: Team[] = json.teams.map((t: any) => ({
        team_number: t.team_number,
        members: t.members.map((m: any) => ({
          student_id: m.student_id,
          student_name: m.student_name,
          score: m.score,
        })),
      }));
      setTeams(loadedTeams);
      setShowTeams(true);
      setIsSaved(true);
      setSavedTeamSize(json.teamRun?.team_size ?? null);
      setSavedMode(json.teamRun?.mode ?? null);
      setMessage("저장된 팀을 불러왔습니다.");
    }
  };

  const handleTeamRun = async () => {
    setMessage(null);
    setError(null);

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
    
    // API에서 반환된 팀 데이터를 사용
    const generatedTeams: Team[] = json.teams.map((t: any) => ({
      team_number: t.team_number,
      members: t.members.map((m: any) => {
        const attempt = attempts.find(a => a.student_id === m.student_id);
        return {
          student_id: m.student_id,
          student_name: attempt?.students?.name ?? "익명",
          score: m.score ?? attempt?.score ?? 0,
        };
      }),
    }));

    setTeams(generatedTeams);
    setShowTeams(true);
    setIsSaved(false);
    setIsEditMode(true);
    const modeLabel = matchingMode === "balanced" ? "역량 균형" : "점수 순";
    setMessage(`팀 매칭 생성 완료 (${json.teamCount}개 팀, 방식: ${modeLabel}) - 저장 버튼을 눌러 저장하세요.`);
  };

  const moveStudent = (fromTeam: number, toTeam: number, studentId: string) => {
    if (!isEditMode) return;
    
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
    setIsSaved(false);
    setMessage("팀 편성이 수정되었습니다. 저장 버튼을 눌러 저장하세요.");
  };

  const handleSave = async () => {
    setMessage(null);
    setError(null);

    if (teams.length === 0) {
      setError("저장할 팀이 없습니다.");
      return;
    }

    const submittedAttempts = attempts.filter(a => a.score !== null && a.submitted_at);
    const teamSize = Math.ceil(submittedAttempts.length / teams.length);

    const response = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teams: teams.map(t => ({
          team_number: t.team_number,
          members: t.members.map(m => ({
            student_id: m.student_id,
            reason: null,
          })),
        })),
        teamSize,
        mode: matchingMode,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "저장 실패");
      return;
    }

    setIsSaved(true);
    setIsEditMode(false);
    setSavedTeamSize(teamSize);
    setSavedMode(matchingMode);
    setMessage("팀이 저장되었습니다.");
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setIsSaved(false);
    setMessage("수정 모드입니다. 팀을 수정한 후 저장 버튼을 눌러주세요.");
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>
                {isSaved ? "저장된 팀" : "팀 매칭 결과"}
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                {isSaved && !isEditMode && (
                  <button
                    onClick={handleEdit}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    수정하기
                  </button>
                )}
                {isEditMode && (
                  <button
                    onClick={handleSave}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    저장
                  </button>
                )}
              </div>
            </div>
            {isSaved && !isEditMode && savedTeamSize && savedMode && (
              <div style={{ 
                marginBottom: 16, 
                padding: 12, 
                background: "#f0f9ff", 
                borderRadius: 8,
                fontSize: "14px",
                color: "#1e40af"
              }}>
                팀 크기: {savedTeamSize}명 | 방식: {savedMode === "balanced" ? "역량 균형" : "점수 순"}
              </div>
            )}
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
                          {isEditMode ? (
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
                          ) : (
                            <span style={{ 
                              fontSize: "12px", 
                              color: "#6b7280",
                              fontWeight: 600
                            }}>
                              팀 {team.team_number}
                            </span>
                          )}
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
          <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>이름</th>
                  <th style={thStyle}>총점</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>CS 역량</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>협업 역량</th>
                  <th style={{ ...thStyle, minWidth: 180 }}>AI 역량</th>
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
                  attempts.map((attempt) => {
                    const renderCategoryCell = (category: "cs" | "collab" | "ai", score: number | null) => {
                      const stats = attempt.category_stats?.[category];
                      const categoryLabels = {
                        cs: { label: "CS", bg: "#eff6ff", color: "#1e40af" },
                        collab: { label: "협업", bg: "#f0fdf4", color: "#166534" },
                        ai: { label: "AI", bg: "#faf5ff", color: "#6b21a8" },
                      };
                      const categoryStyle = categoryLabels[category];

                      if (!stats || stats.total === 0) {
                        return (
                          <div style={{ 
                            padding: "12px",
                            background: "#f9fafb",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            textAlign: "center"
                          }}>
                            <div style={{ 
                              display: "inline-block",
                              background: categoryStyle.bg,
                              color: categoryStyle.color,
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: "11px",
                              fontWeight: 700,
                              marginBottom: 8
                            }}>
                              {categoryStyle.label}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "18px", color: "#9ca3af", marginTop: 4 }}>
                              {score ?? "-"}
                            </div>
                            <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: 4 }}>미응시</div>
                          </div>
                        );
                      }

                      return (
                        <div style={{ 
                          padding: "12px",
                          background: "white",
                          borderRadius: 8,
                          border: "2px solid #e5e7eb",
                          minWidth: 140
                        }}>

                          {/* 통계 아이템들 */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {/* 정답 */}
                            <div style={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center",
                              padding: "6px 8px",
                              background: "rgba(236, 253, 245, 0.2)",
                              borderRadius: 6,
                              border: "1px solid rgba(167, 243, 208, 0.5)"
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ color: "#065f46", fontWeight: 600, fontSize: "13px" }}>
                                  정답
                                </span>
                              </div>
                              <span style={{ fontWeight: 700, color: "#111827", fontSize: "14px" }}>
                                {stats.correct}
                              </span>
                            </div>

                            {/* 패스 */}
                            {stats.pass > 0 && (
                              <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "center",
                                padding: "6px 8px",
                                background: "#fffbeb",
                                borderRadius: 6,
                                border: "1px solid #fde68a"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#f59e0b"
                                  }} />
                                  <span style={{ color: "#92400e", fontWeight: 600, fontSize: "13px" }}>
                                    패스
                                  </span>
                                </div>
                                <span style={{ fontWeight: 700, color: "#111827", fontSize: "14px" }}>
                                  {stats.pass}
                                </span>
                              </div>
                            )}

                            {/* 시간초과 */}
                            {stats.timeout > 0 && (
                              <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "center",
                                padding: "6px 8px",
                                background: "#fef2f2",
                                borderRadius: 6,
                                border: "1px solid #fecaca"
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "#ef4444"
                                  }} />
                                  <span style={{ color: "#991b1b", fontWeight: 600, fontSize: "13px" }}>
                                    시간초과
                                  </span>
                                </div>
                                <span style={{ fontWeight: 700, color: "#111827", fontSize: "14px" }}>
                                  {stats.timeout}
                                </span>
                              </div>
                            )}

                            {/* 전체 문제 수 */}
                            {/* <div style={{
                              borderTop: "1px solid #e5e7eb",
                              paddingTop: 6,
                              marginTop: 2,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}>
                              <span style={{ color: "#6b7280", fontWeight: 500, fontSize: "12px" }}>
                                전체
                              </span>
                              <span style={{ fontWeight: 600, color: "#374151", fontSize: "13px" }}>
                                {stats.total}문제
                              </span>
                            </div> */}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <tr key={attempt.id} style={{ 
                        background: attempt.submitted_at ? "white" : "#fef9c3" 
                      }}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, fontSize: "15px" }}>
                            {attempt.students?.name ?? "익명"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{
                            display: "inline-block",
                            color: "black",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: "16px",
                            textAlign: "center"
                          }}>
                            {attempt.score ?? "-"}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, verticalAlign: "top", paddingTop: 16 }}>
                          {renderCategoryCell("cs", attempt.cs_score)}
                        </td>
                        <td style={{ ...tdStyle, verticalAlign: "top", paddingTop: 16 }}>
                          {renderCategoryCell("collab", attempt.collab_score)}
                        </td>
                        <td style={{ ...tdStyle, verticalAlign: "top", paddingTop: 16 }}>
                          {renderCategoryCell("ai", attempt.ai_score)}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: "13px", color: attempt.submitted_at ? "#111827" : "#9ca3af" }}>
                            {attempt.submitted_at 
                              ? formatDateKR(attempt.submitted_at)
                              : "미제출"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
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
  color: "#374151",
  background: "#f9fafb",
  position: "sticky",
  top: 0,
  zIndex: 10
};

const tdStyle: React.CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid #f3f4f6",
  fontSize: "14px",
  color: "#111827",
  verticalAlign: "middle"
};
