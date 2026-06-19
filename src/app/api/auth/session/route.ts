import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user: user ? { id: user.id, name: user.name, email: user.email } : null });
}
