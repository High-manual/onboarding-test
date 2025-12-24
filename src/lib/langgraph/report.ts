import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

export type CategoryKey = "cs" | "collab" | "ai";

export type CategoryScores = Record<CategoryKey, { correct: number; total: number }>;

export interface ReportInput {
  studentName?: string | null;
  score: number;
  correct: number;
  total: number;
  categoryScores: CategoryScores;
}

export interface ReportResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  mentoringQuestions: string[];
  studyFocus: string[];
  projectContrib: string[];
}

const ReportState = Annotation.Root({
  studentName: Annotation<string | null>(),
  score: Annotation<number>(),
  correct: Annotation<number>(),
  total: Annotation<number>(),
  categoryScores: Annotation<CategoryScores>(),
  strengths: Annotation<string[]>(),
  weaknesses: Annotation<string[]>(),
  recommendations: Annotation<string[]>(),
  mentoringQuestions: Annotation<string[]>(),
  studyFocus: Annotation<string[]>(),
  projectContrib: Annotation<string[]>(),
  summary: Annotation<string>(),
});

const categoryLabel: Record<CategoryKey, string> = {
  cs: "CS 기초 개발 역량",
  collab: "팀 협업 및 커뮤니케이션",
  ai: "AI 도구 활용 능력",
};

const analyzeNode = (state: typeof ReportState.State) => {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const categoryStrengthMap: Record<CategoryKey, string> = {
    cs: "코드 구현과 디버깅을 주도할 수 있습니다",
    collab: "Git 워크플로우와 팀 커뮤니케이션이 안정적입니다",
    ai: "AI 도구를 활용해 팀 생산성을 높일 수 있습니다",
  };

  const categoryWeaknessMap: Record<CategoryKey, string> = {
    cs: "에러 추적과 API 디버깅에서 막힐 수 있습니다",
    collab: "PR 단위 분리와 코드 리뷰 과정에서 어려움을 겪을 수 있습니다",
    ai: "LLM 응답 검증과 프롬프트 최적화가 필요합니다",
  };

  (Object.keys(state.categoryScores) as CategoryKey[]).forEach((key) => {
    const { correct, total } = state.categoryScores[key];
    if (total === 0) return;
    const ratio = correct / total;
    if (ratio >= 0.7) strengths.push(categoryStrengthMap[key]);
    if (ratio <= 0.4) weaknesses.push(categoryWeaknessMap[key]);
  });

  return { strengths, weaknesses };
};

const summaryNode = async (state: typeof ReportState.State) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback: 팀 기여 관점의 요약
    const namePrefix = state.studentName ? `${state.studentName}님은 ` : "이 학생은 ";
    let summary = "";
    
    const csRatio = state.categoryScores.cs.total > 0 ? state.categoryScores.cs.correct / state.categoryScores.cs.total : 0;
    const collabRatio = state.categoryScores.collab.total > 0 ? state.categoryScores.collab.correct / state.categoryScores.collab.total : 0;
    const aiRatio = state.categoryScores.ai.total > 0 ? state.categoryScores.ai.correct / state.categoryScores.ai.total : 0;
    
    if (csRatio >= 0.7 && collabRatio >= 0.7) {
      summary = `${namePrefix}코드 구현과 협업 프로세스 모두 안정적입니다. 팀 내에서 기술적 의사결정과 코드 리뷰를 주도할 수 있는 팀원입니다.`;
    } else if (collabRatio >= 0.7) {
      summary = `${namePrefix}Git 워크플로우와 팀 커뮤니케이션에 강점이 있습니다. 코드 구현 역량을 보완하면서 팀 내 프로세스 정리 역할을 맡으면 좋겠습니다.`;
    } else if (csRatio >= 0.7) {
      summary = `${namePrefix}개발 구현 능력은 탄탄하지만, 협업 경험이 부족합니다. 작은 단위로 PR을 나누고 코드 리뷰를 주고받는 연습이 필요합니다.`;
    } else if (aiRatio >= 0.7) {
      summary = `${namePrefix}AI 도구 활용에 익숙합니다. 이를 활용해 프로젝트 문서화, 테스트 케이스 작성 등 팀 생산성을 높이는 역할에 집중하면 좋겠습니다.`;
    } else {
      summary = `${namePrefix}아직 프로젝트 경험이 부족한 상태입니다. 작은 이슈부터 시작해 실행→오류→해결 사이클을 반복하며 감을 익히는 단계가 필요합니다.`;
    }
    
    return { summary };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7,
      apiKey: apiKey,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `너는 AI-X 프로젝트 기반 개발 과정의 교육 멘토다.

학생을 평가하지 말고, 이 학생이 "팀에서 어떤 타입의 팀원인지"를 2~3문장으로 요약해라.

규칙:
- 점수 나열 금지
- 추상적 표현 금지 (예: "열심히", "노력")
- 프로젝트에서 이 학생이 어떻게 기여할 수 있는지 중심으로 작성
- 부족한 부분은 "보완 방향"으로 제시`],
      ["user", `학생 이름: {studentName}
총점: {score}점 (정답: {correct}/{total})

역량별 정답률:
- CS (구현): {csCorrect}/{csTotal} ({csPercent}%)
- 협업 (Git 중심): {collabCorrect}/{collabTotal} ({collabPercent}%)
- AI (LLM/Agent/RAG): {aiCorrect}/{aiTotal} ({aiPercent}%)

강점: {strengths}
약점: {weaknesses}

이 학생이 팀에서 어떤 역할을 할 수 있는 팀원인지 요약해라.`]
    ]);

    const chain = prompt.pipe(llm);
    const response = await chain.invoke({
      studentName: state.studentName || "이 학생",
      score: state.score,
      correct: state.correct,
      total: state.total,
      csCorrect: state.categoryScores.cs.correct,
      csTotal: state.categoryScores.cs.total,
      csPercent: state.categoryScores.cs.total > 0 ? Math.round((state.categoryScores.cs.correct / state.categoryScores.cs.total) * 100) : 0,
      collabCorrect: state.categoryScores.collab.correct,
      collabTotal: state.categoryScores.collab.total,
      collabPercent: state.categoryScores.collab.total > 0 ? Math.round((state.categoryScores.collab.correct / state.categoryScores.collab.total) * 100) : 0,
      aiCorrect: state.categoryScores.ai.correct,
      aiTotal: state.categoryScores.ai.total,
      aiPercent: state.categoryScores.ai.total > 0 ? Math.round((state.categoryScores.ai.correct / state.categoryScores.ai.total) * 100) : 0,
      strengths: state.strengths.length > 0 ? state.strengths.join(", ") : "아직 두드러진 강점 없음",
      weaknesses: state.weaknesses.length > 0 ? state.weaknesses.join(", ") : "없음",
    });

    return { summary: response.content as string };
  } catch (error) {
    console.error("LLM 요약 생성 실패, fallback 사용:", error);
    const namePrefix = state.studentName ? `${state.studentName}님은 ` : "이 학생은 ";
    const summary = `${namePrefix}프로젝트 경험을 쌓아가는 단계입니다. 작은 이슈부터 시작해 실행과 오류 해결 사이클을 반복하며 성장할 수 있습니다.`;
    return { summary };
  }
};

const recommendNode = async (state: typeof ReportState.State) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback: 단기 행동 지침
    const recommendations: string[] = [];

    if (state.weaknesses.length === 0) {
      recommendations.push("다음 프로젝트에서는 기술 스택 선정 근거를 문서화하며 의사결정 경험을 쌓으세요.");
      recommendations.push("팀원의 PR을 리뷰하며 '왜 이렇게 구현했는지' 질문하는 연습을 하세요.");
    } else {
      state.weaknesses.forEach((label) => {
        if (label.includes("CS")) {
          recommendations.push("에러가 발생하면 스택 트레이스를 읽고 어느 함수에서 터졌는지 추적하는 연습을 하세요.");
          recommendations.push("API 응답이 예상과 다를 때, 요청 파라미터와 응답 구조를 비교하며 원인을 찾는 습관을 들이세요.");
        }
        if (label.includes("협업")) {
          recommendations.push("커밋 메시지에 '왜 이 변경이 필요한지' 한 줄 추가하는 습관을 들이세요.");
          recommendations.push("PR을 올리기 전에 변경 사항을 3개 이하 단위로 쪼갤 수 있는지 확인하세요.");
        }
        if (label.includes("AI")) {
          recommendations.push("LLM 응답을 받으면 '이게 정확한지' 검증 기준을 먼저 정하고 테스트하세요.");
          recommendations.push("프롬프트를 작성할 때 예시 입출력을 2개 이상 포함해보세요.");
        }
      });
    }

    if (recommendations.length < 3 && state.strengths.length > 0) {
      recommendations.push(`${state.strengths[0]} 강점을 살려 팀 내 관련 이슈를 먼저 맡아보세요.`);
    }

    return { recommendations: recommendations.slice(0, 5) };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.8,
      apiKey: apiKey,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `너는 AI-X 프로젝트 과정의 교육 멘토다.

학생에게 "다음 프로젝트에서 이렇게 움직이면 좋아진다" 수준의 단기 행동 지침을 3~5개 제시해라.

절대 금지:
- 추상적 조언 (예: "열심히", "공부하세요")
- 외부 링크, 유튜브, 참고 자료 추천
- 지식 나열 (예: "알고리즘을 배우세요")

반드시 포함:
- 구체적 행동 (예: "에러 발생 시 스택 트레이스 읽기")
- 프로젝트 상황 기반 (예: "PR 올리기 전에 변경사항 3개 이하로 쪼개기")

각 추천은 한 문장으로 작성하라.`],
      ["user", `학생 정보:
총점: {score}점
강점: {strengths}
약점: {weaknesses}

역량별 정답률:
- CS: {csCorrect}/{csTotal} ({csPercent}%)
- 협업: {collabCorrect}/{collabTotal} ({collabPercent}%)
- AI: {aiCorrect}/{aiTotal} ({aiPercent}%)

이 학생이 다음 프로젝트에서 바로 실천할 수 있는 행동 지침을 제시해라.`]
    ]);

    const chain = prompt.pipe(llm);
    const response = await chain.invoke({
      score: state.score,
      strengths: state.strengths.length > 0 ? state.strengths.join(", ") : "아직 두드러진 강점 없음",
      weaknesses: state.weaknesses.length > 0 ? state.weaknesses.join(", ") : "없음",
      csCorrect: state.categoryScores.cs.correct,
      csTotal: state.categoryScores.cs.total,
      csPercent: state.categoryScores.cs.total > 0 ? Math.round((state.categoryScores.cs.correct / state.categoryScores.cs.total) * 100) : 0,
      collabCorrect: state.categoryScores.collab.correct,
      collabTotal: state.categoryScores.collab.total,
      collabPercent: state.categoryScores.collab.total > 0 ? Math.round((state.categoryScores.collab.correct / state.categoryScores.collab.total) * 100) : 0,
      aiCorrect: state.categoryScores.ai.correct,
      aiTotal: state.categoryScores.ai.total,
      aiPercent: state.categoryScores.ai.total > 0 ? Math.round((state.categoryScores.ai.correct / state.categoryScores.ai.total) * 100) : 0,
    });

    const recommendations = (response.content as string)
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(line => line.length > 0);

    return { recommendations: recommendations.slice(0, 5) };
  } catch (error) {
    console.error("LLM 추천 생성 실패, fallback 사용:", error);
    const recommendations: string[] = [];
    
    if (state.weaknesses.length === 0) {
      recommendations.push("다음 프로젝트에서는 기술 스택 선정 근거를 문서화하며 의사결정 경험을 쌓으세요.");
    } else {
      state.weaknesses.forEach((label) => {
        if (label.includes("CS")) recommendations.push("에러 발생 시 스택 트레이스를 읽고 어느 함수에서 터졌는지 추적하는 연습을 하세요.");
        if (label.includes("협업")) recommendations.push("커밋 메시지에 '왜 이 변경이 필요한지' 한 줄 추가하는 습관을 들이세요.");
        if (label.includes("AI")) recommendations.push("LLM 응답을 받으면 정확성 검증 기준을 먼저 정하고 테스트하세요.");
      });
    }

    return { recommendations: recommendations.slice(0, 5) };
  }
};

const mentoringQuestionsNode = async (state: typeof ReportState.State) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback: 규칙 기반 질문 생성
    const questions: string[] = [];
    
    state.weaknesses.forEach((label) => {
      if (label.includes("CS")) {
        questions.push("이 에러 메시지에서 어느 부분을 먼저 봐야 원인을 찾을 수 있을까요?");
        questions.push("API 응답이 예상과 다를 때, 어떤 순서로 디버깅하면 좋을까요?");
      }
      if (label.includes("협업")) {
        questions.push("제가 이 PR을 이렇게 나눈 이유가 적절한지 봐주실 수 있을까요?");
        questions.push("커밋 메시지를 이렇게 작성했는데, 팀원이 이해하기 쉬울까요?");
      }
      if (label.includes("AI")) {
        questions.push("LLM 응답의 정확도를 어떤 기준으로 평가하면 좋을까요?");
        questions.push("이 프롬프트에서 어떤 부분을 수정하면 더 일관된 답변을 받을 수 있을까요?");
      }
    });
    
    // 공통 질문
    questions.push("제가 막힌 이 부분, 어떤 키워드로 검색하면 관련 자료를 찾을 수 있을까요?");
    questions.push("팀 프로젝트에서 제가 먼저 맡으면 좋을 이슈는 어떤 유형일까요?");
    
    return { mentoringQuestions: questions.slice(0, 8) };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.8,
      apiKey: apiKey,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `너는 AI-X 프로젝트 과정의 교육 멘토다.

학생이 멘토링 시간에 그대로 읽어도 되는 질문 5~8개를 만들어라.

필수 조건:
- 반드시 구체적 상황 + 질문 형태
- 학생이 복사해서 바로 물어볼 수 있는 수준
- 추상적 질문 금지 (예: "어떻게 공부하나요?")

좋은 예시:
- "제가 이 PR을 3개로 나눈 이유가 적절한지 봐주실 수 있을까요?"
- "이 에러를 재현하기 위해 어떤 조건부터 정리하는 게 좋을까요?"
- "LLM 응답이 매번 달라지는데, 일관성을 높이려면 프롬프트에 뭘 추가해야 할까요?"

나쁜 예시:
- "Git을 어떻게 배우나요?"
- "프로젝트를 잘하려면?"

각 질문은 한 문장으로 작성하라.`],
      ["user", `학생 정보:
강점: {strengths}
약점: {weaknesses}

역량별 정답률:
- CS: {csCorrect}/{csTotal} ({csPercent}%)
- 협업: {collabCorrect}/{collabTotal} ({collabPercent}%)
- AI: {aiCorrect}/{aiTotal} ({aiPercent}%)

이 학생이 멘토에게 물어보면 좋을 구체적인 질문들을 만들어라.`]
    ]);

    const chain = prompt.pipe(llm);
    const response = await chain.invoke({
      strengths: state.strengths.length > 0 ? state.strengths.join(", ") : "아직 두드러진 강점 없음",
      weaknesses: state.weaknesses.length > 0 ? state.weaknesses.join(", ") : "없음",
      csCorrect: state.categoryScores.cs.correct,
      csTotal: state.categoryScores.cs.total,
      csPercent: state.categoryScores.cs.total > 0 ? Math.round((state.categoryScores.cs.correct / state.categoryScores.cs.total) * 100) : 0,
      collabCorrect: state.categoryScores.collab.correct,
      collabTotal: state.categoryScores.collab.total,
      collabPercent: state.categoryScores.collab.total > 0 ? Math.round((state.categoryScores.collab.correct / state.categoryScores.collab.total) * 100) : 0,
      aiCorrect: state.categoryScores.ai.correct,
      aiTotal: state.categoryScores.ai.total,
      aiPercent: state.categoryScores.ai.total > 0 ? Math.round((state.categoryScores.ai.correct / state.categoryScores.ai.total) * 100) : 0,
    });

    const questions = (response.content as string)
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(line => line.includes('?') || line.includes('까요'));

    return { mentoringQuestions: questions.slice(0, 8) };
  } catch (error) {
    console.error("LLM 멘토링 질문 생성 실패, fallback 사용:", error);
    const questions = [
      "이 에러 메시지에서 어느 부분을 먼저 봐야 원인을 찾을 수 있을까요?",
      "제가 이 PR을 이렇게 나눈 이유가 적절한지 봐주실 수 있을까요?",
      "LLM 응답의 정확도를 어떤 기준으로 평가하면 좋을까요?",
      "팀 프로젝트에서 제가 먼저 맡으면 좋을 이슈는 어떤 유형일까요?",
      "제가 막힌 이 부분, 어떤 키워드로 검색하면 관련 자료를 찾을 수 있을까요?",
    ];
    return { mentoringQuestions: questions };
  }
};

const studyFocusNode = async (state: typeof ReportState.State) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback: 실습 기반 학습 포인트
    const focus: string[] = [];
    
    state.weaknesses.forEach((label) => {
      if (label.includes("CS")) {
        focus.push("환경변수 누락으로 발생하는 배포 오류 흐름 정리");
        focus.push("API 요청 실패 시 상태 코드별 대응 방법 정리");
        focus.push("로그를 읽고 에러 발생 지점을 역추적하는 연습");
      }
      if (label.includes("협업")) {
        focus.push("브랜치 전략별 머지 시나리오 실습 (feature → develop → main)");
        focus.push("충돌 발생 시 어느 코드를 살릴지 판단하는 기준 정리");
        focus.push("PR 설명에 변경 이유와 테스트 방법을 포함하는 연습");
      }
      if (label.includes("AI")) {
        focus.push("LLM 응답을 정확도/근거/일관성 기준으로 비교하는 연습");
        focus.push("같은 질문에 대해 프롬프트를 3가지 방식으로 작성하고 결과 비교");
        focus.push("RAG 시스템에서 검색된 문서의 관련성을 평가하는 기준 정리");
      }
    });
    
    if (focus.length < 4) {
      focus.push("작은 기능 하나를 로컬 → 스테이징 → 프로덕션 순서로 배포해보기");
      focus.push("팀원의 코드를 읽고 '왜 이렇게 짰는지' 추론하는 연습");
    }
    
    return { studyFocus: focus.slice(0, 7) };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.8,
      apiKey: apiKey,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `너는 AI-X 프로젝트 과정의 교육 멘토다.

학생에게 실습/상황 기반 학습 포인트 4~7개를 제시해라.

절대 금지:
- 개념 공부 (예: "알고리즘 공부")
- 강의/책 추천
- 추상적 표현

반드시 포함:
- 실습 중심 (예: "환경변수 누락으로 발생하는 배포 오류 흐름 정리")
- 상황 기반 (예: "LLM 응답을 정확도/근거/일관성 기준으로 비교하는 연습")

좋은 예시:
- "API 요청 실패 시 상태 코드별 대응 방법 정리"
- "충돌 발생 시 어느 코드를 살릴지 판단하는 기준 정리"
- "같은 질문에 대해 프롬프트를 3가지 방식으로 작성하고 결과 비교"

나쁜 예시:
- "Git 공부하기"
- "알고리즘 강의 듣기"

각 항목은 한 문장으로 작성하라.`],
      ["user", `학생 정보:
강점: {strengths}
약점: {weaknesses}

역량별 정답률:
- CS: {csCorrect}/{csTotal} ({csPercent}%)
- 협업: {collabCorrect}/{collabTotal} ({collabPercent}%)
- AI: {aiCorrect}/{aiTotal} ({aiPercent}%)

이 학생이 프로젝트 중 실습하며 익혀야 할 학습 포인트를 제시해라.`]
    ]);

    const chain = prompt.pipe(llm);
    const response = await chain.invoke({
      strengths: state.strengths.length > 0 ? state.strengths.join(", ") : "아직 두드러진 강점 없음",
      weaknesses: state.weaknesses.length > 0 ? state.weaknesses.join(", ") : "없음",
      csCorrect: state.categoryScores.cs.correct,
      csTotal: state.categoryScores.cs.total,
      csPercent: state.categoryScores.cs.total > 0 ? Math.round((state.categoryScores.cs.correct / state.categoryScores.cs.total) * 100) : 0,
      collabCorrect: state.categoryScores.collab.correct,
      collabTotal: state.categoryScores.collab.total,
      collabPercent: state.categoryScores.collab.total > 0 ? Math.round((state.categoryScores.collab.correct / state.categoryScores.collab.total) * 100) : 0,
      aiCorrect: state.categoryScores.ai.correct,
      aiTotal: state.categoryScores.ai.total,
      aiPercent: state.categoryScores.ai.total > 0 ? Math.round((state.categoryScores.ai.correct / state.categoryScores.ai.total) * 100) : 0,
    });

    const focus = (response.content as string)
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(line => line.length > 0);

    return { studyFocus: focus.slice(0, 7) };
  } catch (error) {
    console.error("LLM 학습 포인트 생성 실패, fallback 사용:", error);
    const focus = [
      "환경변수 누락으로 발생하는 배포 오류 흐름 정리",
      "API 요청 실패 시 상태 코드별 대응 방법 정리",
      "브랜치 전략별 머지 시나리오 실습",
      "LLM 응답을 정확도/근거/일관성 기준으로 비교하는 연습",
    ];
    return { studyFocus: focus };
  }
};

const projectContribNode = async (state: typeof ReportState.State) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback: 팀 내 기여 역할
    const contrib: string[] = [];
    
    const csRatio = state.categoryScores.cs.total > 0 ? state.categoryScores.cs.correct / state.categoryScores.cs.total : 0;
    const collabRatio = state.categoryScores.collab.total > 0 ? state.categoryScores.collab.correct / state.categoryScores.collab.total : 0;
    const aiRatio = state.categoryScores.ai.total > 0 ? state.categoryScores.ai.correct / state.categoryScores.ai.total : 0;
    
    if (csRatio >= 0.7) {
      contrib.push("에러 재현 → 원인 후보 정리 → 이슈 작성");
      contrib.push("API 설계 및 엔드포인트 구조 제안");
    }
    
    if (collabRatio >= 0.7) {
      contrib.push("PR을 작은 단위로 쪼개는 역할");
      contrib.push("팀 내 Git 워크플로우 가이드 작성");
      contrib.push("코드 리뷰 시 개선 포인트 구체화");
    }
    
    if (aiRatio >= 0.7) {
      contrib.push("LLM 프롬프트 템플릿 정리 및 공유");
      contrib.push("AI 도구를 활용한 테스트 케이스 작성");
    }
    
    // 공통
    if (contrib.length < 3) {
      contrib.push("실행 방법/트러블슈팅 문서 정리");
      contrib.push("작은 버그 수정 이슈부터 시작");
    }
    
    contrib.push("팀 회고 시 프로세스 개선 포인트 제안");
    
    return { projectContrib: contrib.slice(0, 6) };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.8,
      apiKey: apiKey,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `너는 AI-X 프로젝트 과정의 교육 멘토다.

이 학생이 팀에서 맡으면 좋은 역할을 3~6개 제시해ra.

절대 금지:
- 직책 (예: "팀장", "백엔드 개발자")
- 추상적 역할 (예: "열심히 하기")

반드시 포함:
- 실제 기여 단위 (예: "에러 재현 → 원인 후보 정리 → 이슈 작성")
- 구체적 행동 (예: "PR을 작은 단위로 쪼개는 역할")

좋은 예시:
- "API 설계 및 엔드포인트 구조 제안"
- "실행 방법/트러블슈팅 문서 정리"
- "LLM 프롬프트 템플릿 정리 및 공유"
- "팀 회고 시 프로세스 개선 포인트 제안"

나쁜 예시:
- "백엔드 담당"
- "열심히 코딩"

각 항목은 한 문장으로 작성하라.`],
      ["user", `학생 정보:
강점: {strengths}
약점: {weaknesses}

역량별 정답률:
- CS: {csCorrect}/{csTotal} ({csPercent}%)
- 협업: {collabCorrect}/{collabTotal} ({collabPercent}%)
- AI: {aiCorrect}/{aiTotal} ({aiPercent}%)

이 학생이 팀에서 기여할 수 있는 구체적인 역할을 제시해라.`]
    ]);

    const chain = prompt.pipe(llm);
    const response = await chain.invoke({
      strengths: state.strengths.length > 0 ? state.strengths.join(", ") : "아직 두드러진 강점 없음",
      weaknesses: state.weaknesses.length > 0 ? state.weaknesses.join(", ") : "없음",
      csCorrect: state.categoryScores.cs.correct,
      csTotal: state.categoryScores.cs.total,
      csPercent: state.categoryScores.cs.total > 0 ? Math.round((state.categoryScores.cs.correct / state.categoryScores.cs.total) * 100) : 0,
      collabCorrect: state.categoryScores.collab.correct,
      collabTotal: state.categoryScores.collab.total,
      collabPercent: state.categoryScores.collab.total > 0 ? Math.round((state.categoryScores.collab.correct / state.categoryScores.collab.total) * 100) : 0,
      aiCorrect: state.categoryScores.ai.correct,
      aiTotal: state.categoryScores.ai.total,
      aiPercent: state.categoryScores.ai.total > 0 ? Math.round((state.categoryScores.ai.correct / state.categoryScores.ai.total) * 100) : 0,
    });

    const contrib = (response.content as string)
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*\d.]\s*/, '').trim())
      .filter(line => line.length > 0);

    return { projectContrib: contrib.slice(0, 6) };
  } catch (error) {
    console.error("LLM 프로젝트 기여 역할 생성 실패, fallback 사용:", error);
    const contrib = [
      "에러 재현 → 원인 후보 정리 → 이슈 작성",
      "실행 방법/트러블슈팅 문서 정리",
      "작은 버그 수정 이슈부터 시작",
      "팀 회고 시 프로세스 개선 포인트 제안",
    ];
    return { projectContrib: contrib };
  }
};

const reportGraph = new StateGraph(ReportState)
  .addNode("analyze", analyzeNode)
  .addNode("summarize", summaryNode)
  .addNode("recommend", recommendNode)
  .addNode("generateMentoringQuestions", mentoringQuestionsNode)
  .addNode("generateStudyFocus", studyFocusNode)
  .addNode("generateProjectContrib", projectContribNode)
  .addEdge(START, "analyze")
  .addEdge("analyze", "summarize")
  .addEdge("summarize", "recommend")
  .addEdge("recommend", "generateMentoringQuestions")
  .addEdge("generateMentoringQuestions", "generateStudyFocus")
  .addEdge("generateStudyFocus", "generateProjectContrib")
  .addEdge("generateProjectContrib", END)
  .compile();

export async function generateReport(input: ReportInput): Promise<ReportResult> {
  const result = await reportGraph.invoke({
    studentName: input.studentName ?? null,
    score: input.score,
    correct: input.correct,
    total: input.total,
    categoryScores: input.categoryScores,
  });

  return {
    summary: result.summary,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    recommendations: result.recommendations,
    mentoringQuestions: result.mentoringQuestions,
    studyFocus: result.studyFocus,
    projectContrib: result.projectContrib,
  };
}
