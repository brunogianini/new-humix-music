import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { shameNoteCreateSchema } from "@/lib/validation";
import { notifyShamed } from "@/lib/notify";
import { recommendationStatus } from "@/lib/friendship";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = shameNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const recommendation = await prisma.albumRecommendation.findUnique({
    where: { id },
    include: { shameNote: true },
  });
  if (!recommendation) {
    return NextResponse.json({ error: "Recomendação não encontrada." }, { status: 404 });
  }
  if (recommendation.fromUserId !== userId) {
    return NextResponse.json(
      { error: "Só quem recomendou o álbum pode deixar a nota de vergonha." },
      { status: 403 }
    );
  }
  if (recommendationStatus(recommendation) !== "EXPIRED") {
    return NextResponse.json(
      { error: "Essa recomendação não está expirada e sem resenha." },
      { status: 400 }
    );
  }

  const shameNote = await prisma.shameNote.create({
    data: {
      recommendationId: recommendation.id,
      authorId: userId,
      targetUserId: recommendation.toUserId,
      text: parsed.data.text,
    },
  });

  await notifyShamed(userId, recommendation.toUserId, recommendation.albumId);

  return NextResponse.json({
    shameNote: { id: shameNote.id, text: shameNote.text, createdAt: shameNote.createdAt.toISOString() },
  });
}
