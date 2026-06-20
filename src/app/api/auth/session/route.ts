import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, name: user.name, email: user.email },
  });
}
