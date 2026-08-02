import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/lib/auth/session";

/**
 * POST only. A GET logout can be triggered by any image tag on any page, which
 * is a petty but real annoyance to sign people out with.
 */
export async function POST(request: NextRequest) {
  await endSession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
