export type QuestionCategory = "cs" | "collab" | "ai";

export interface Question {
  id: number;
  category: QuestionCategory;
  prompt: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  answer: "A" | "B" | "C";
}

export interface Attempt {
  id: string;
  student_id: string;
  status: "in_progress" | "submitted" | "graded";
  total_score: number | null;
  cs_score: number | null;
  collab_score: number | null;
  ai_score: number | null;
  report_md: string | null;
  created_at: string;
  submitted_at: string | null;
}

export interface TeamRun {
  id: string;
  team_count: number;
  status: "draft" | "final";
  created_at: string;
}
