import { NextResponse, type NextRequest } from "next/server";
import { registerCurrentDevice } from "@/lib/devices";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const nextPath = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  await registerCurrentDevice(nextPath);
  return NextResponse.redirect(new URL(nextPath, request.url));
}