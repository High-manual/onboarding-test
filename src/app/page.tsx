import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "12px" }}>온보딩 시험 & 팀 매칭</h1>
      <p style={{ marginBottom: "24px" }}>
        익명 로그인으로 시험을 치고, 관리자 화면에서 점수 확인과 팀 매칭을 수행합니다. 먼저 학생용 시작 페이지로
        이동하세요.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Link
          href="/start"
          style={{
            background: "#111827",
            color: "white",
            padding: "12px 16px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          학생 시작하기
        </Link>
        <Link
          href="/admin/login"
          style={{
            border: "1px solid #d1d5db",
            padding: "12px 16px",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          관리자 로그인
        </Link>
      </div>
    </main>
  );
}
