export type QuestionCategory = "cs" | "collab" | "ai";

export interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: "A" | "B" | "C" | "D" | "E";
  category: QuestionCategory;
  created_at: string;
}

export interface Attempt {
  id: string;
  student_id: string;
  score: number | null;
  cs_score: number | null;
  collab_score: number | null;
  ai_score: number | null;
  submitted_at: string | null;
  created_at: string;
}

export interface TeamRun {
  id: string;
  team_size: number;
  mode: "rank" | "balanced";
  created_at: string;
}

export interface Team {
  id: string;
  run_id: string;
  team_number: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  student_id: string;
  reason: string | null;
  created_at: string;
}
