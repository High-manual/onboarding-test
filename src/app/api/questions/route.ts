import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from("questions").select("*").order("id", { ascending: true }).limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questions: data });
}
