import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  await prisma.externalAccount.deleteMany({ where: { userId, provider: "SPOTIFY" } });
  return NextResponse.json({ ok: true });
}
