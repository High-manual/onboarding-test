import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("questions")
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data });
}
