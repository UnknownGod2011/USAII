import { requireSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { deleteUserState, productionBlobStateEnabled } from "@/lib/blobState";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";
export async function DELETE() {
  try {
    const user = await requireSessionUser();
    if (productionBlobStateEnabled()) {
      await deleteUserState(user.id);
    } else {
      await getDb().user.delete({ where: { id: user.id } });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ error: "Could not delete account data." }, { status: 400 }); }
}
