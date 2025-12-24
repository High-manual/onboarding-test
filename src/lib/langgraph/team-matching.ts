import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { CategoryKey } from "./report";

export type MatchingMode = "rank" | "balanced";

export interface MatchAttempt {
  id: string;
  student_id: string;
  score: number | null;
  cs_score: number | null;
  collab_score: number | null;
  ai_score: number | null;
}

export interface TeamAssignment {
  teamIndex: number;
  studentId: string;
  attemptId: string;
  reason: string;
}

export interface TeamMatchResult {
  teamCount: number;
  assignments: TeamAssignment[];
}

const TeamMatchState = Annotation.Root({
  attempts: Annotation<MatchAttempt[]>(),
  teamSize: Annotation<number>(),
  mode: Annotation<MatchingMode>(),
  assignments: Annotation<TeamAssignment[]>(),
  teamCount: Annotation<number>(),
});

const categoryOrder: CategoryKey[] = ["cs", "collab", "ai"];

const getPrimarySkill = (attempt: MatchAttempt): CategoryKey => {
  const cs = attempt.cs_score ?? 0;
  const collab = attempt.collab_score ?? 0;
  const ai = attempt.ai_score ?? 0;
  if (cs >= collab && cs >= ai) return "cs";
  if (collab >= cs && collab >= ai) return "collab";
  return "ai";
};

const orderAttempts = (attempts: MatchAttempt[], mode: MatchingMode) => {
  const sorted = [...attempts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (mode === "rank") return sorted;

  const buckets: Record<CategoryKey, MatchAttempt[]> = {
    cs: [],
    collab: [],
    ai: [],
  };

  sorted.forEach((attempt) => {
    buckets[getPrimarySkill(attempt)].push(attempt);
  });

  const balanced: MatchAttempt[] = [];
  while (balanced.length < sorted.length) {
    categoryOrder.forEach((category) => {
      const next = buckets[category].shift();
      if (next) balanced.push(next);
    });
  }

  return balanced;
};

const assignNode = (state: typeof TeamMatchState.State) => {
  const ordered = orderAttempts(state.attempts, state.mode);
  const teamCount = Math.ceil(ordered.length / state.teamSize);
  const assignments: TeamAssignment[] = ordered.map((attempt, index) => {
    const teamIndex = index % teamCount;
    const primary = getPrimarySkill(attempt);
    const primaryLabel = primary === "cs" ? "CS" : primary === "collab" ? "협업" : "AI";
    const reason =
      state.mode === "rank"
        ? `총점 순위 ${index + 1} 기반으로 팀 균형을 위해 배정`
        : `주요 강점(${primaryLabel})을 고려해 팀 균형을 맞춤`;

    return {
      teamIndex,
      studentId: attempt.student_id,
      attemptId: attempt.id,
      reason,
    };
  });

  return { assignments, teamCount };
};

const teamMatchGraph = new StateGraph(TeamMatchState)
  .addNode("assign", assignNode)
  .addEdge(START, "assign")
  .addEdge("assign", END)
  .compile();

export async function matchTeams(
  attempts: MatchAttempt[],
  teamSize: number,
  mode: MatchingMode,
): Promise<TeamMatchResult> {
  const result = await teamMatchGraph.invoke({ attempts, teamSize, mode });
  return { teamCount: result.teamCount, assignments: result.assignments };
}
