import Link from "next/link";

export default function Home() {
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
        maxWidth: 640, 
        width: "100%",
        background: "white",
        borderRadius: 16,
        padding: "48px 32px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ 
            fontSize: "40px", 
            fontWeight: 800, 
            marginBottom: "16px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            프로젝트 역량 평가
          </h1>
          <p style={{ 
            fontSize: "18px", 
            color: "#6b7280", 
            lineHeight: 1.6,
            marginBottom: 8
          }}>
            CS, 협업, AI 역량을 종합적으로 평가하고
          </p>
          <p style={{ 
            fontSize: "18px", 
            color: "#6b7280", 
            lineHeight: 1.6
          }}>
            최적의 팀 매칭을 지원합니다
          </p>
        </div>

        <div style={{ 
          background: "#f9fafb", 
          borderRadius: 12, 
          padding: 24,
          marginBottom: 32
        }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: "50%", 
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: "#3b82f6",
                flexShrink: 0
              }}>
                1
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                  30문항 역량 평가
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                  CS 기초, 협업 능력, AI 활용 능력을 평가합니다
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: "50%", 
                background: "#f0fdf4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: "#10b981",
                flexShrink: 0
              }}>
                2
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                  실시간 결과 분석
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                  강점과 약점을 한눈에 확인할 수 있습니다
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: "50%", 
                background: "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: "#f59e0b",
                flexShrink: 0
              }}>
                3
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                  자동 팀 매칭
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
                  성적 분포를 고려한 균형잡힌 팀 구성을 제공합니다
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/start"
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 24px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "16px",
              textAlign: "center",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              transition: "transform 0.2s, box-shadow 0.2s",
              minWidth: 200
            }}
          >
            수강생 시작하기
          </Link>
          <Link
            href="/admin/login"
            style={{
              padding: "16px 24px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "16px",
              textAlign: "center",
              border: "2px solid #e5e7eb",
              background: "white",
              color: "#374151",
              transition: "all 0.2s",
              minWidth: 160
            }}
          >
            관리자 로그인
          </Link>
        </div>
      </div>
    </main>
  );
}
