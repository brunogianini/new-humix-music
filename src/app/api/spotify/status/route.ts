import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const account = await prisma.externalAccount.findUnique({
    where: { userId_provider: { userId, provider: "SPOTIFY" } },
    select: { updatedAt: true },
  });

  return NextResponse.json({
    connected: !!account,
    connectedAt: account?.updatedAt.toISOString() ?? null,
  });
}
