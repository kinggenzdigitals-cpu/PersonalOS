import { NextResponse, type NextRequest } from "next/server";
import { registerCurrentDevice } from "@/lib/devices";
import { safeNextPath } from "@/lib/safe-next";

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  await registerCurrentDevice(nextPath);
  return NextResponse.redirect(new URL(nextPath, request.url));
}