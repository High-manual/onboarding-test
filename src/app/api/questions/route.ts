import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Questions는 자주 변경되지 않으므로 캐싱하여 동시 요청 시 DB 부하 감소
async function getQuestionsFromDB() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .order("category", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

const getCachedQuestions = unstable_cache(
  async () => getQuestionsFromDB(),
  ['questions'],
  {
    revalidate: 300, // 5분간 캐시 유지
    tags: ['questions'],
  }
);

export async function GET() {
  try {
    const data = await getCachedQuestions();
    return NextResponse.json({ questions: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "문항 조회 실패" },
      { status: 500 }
    );
  }
}
