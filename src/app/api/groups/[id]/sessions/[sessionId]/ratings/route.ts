import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { sessionRatingSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { isGroupMember } from "@/lib/groups";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId, sessionId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sessionRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!(await isGroupMember(groupId, userId))) {
    return NextResponse.json({ error: "Você não é membro desse grupo." }, { status: 403 });
  }

  const session = await prisma.listeningSession.findFirst({ where: { id: sessionId, groupId } });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  const { rating, review } = parsed.data;
  const saved = await prisma.listeningSessionRating.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId, rating, review: review ?? null },
    update: { rating, review: review ?? null },
  });

  return NextResponse.json({
    rating: { userId: saved.userId, rating: saved.rating, review: saved.review },
  });
}
