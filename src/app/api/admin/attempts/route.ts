import { NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    assertAdminSession();
  } catch {
    return NextResponse.json({ error: "관리자 인증 필요" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      `
        id,
        student_id,
        status,
        total_score,
        cs_score,
        collab_score,
        ai_score,
        report_md,
        created_at,
        submitted_at,
        students:student_id ( display_name )
      `,
    )
    .order("total_score", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attempts: data });
}
