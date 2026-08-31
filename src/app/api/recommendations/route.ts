import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { recommendationCreateSchema } from "@/lib/validation";
import { notifyRecommended } from "@/lib/notify";
import { isMutualFollow, listRecommendations, toRecommendationDTO } from "@/lib/friendship";

const RECOMMENDATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const scopeParam = req.nextUrl.searchParams.get("scope");
  const scope = scopeParam === "sent" ? "sent" : "received";

  const recommendations = await listRecommendations(userId, scope);
  return NextResponse.json({ recommendations });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = recommendationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { toUserId, albumId, message } = parsed.data;

  if (toUserId === userId) {
    return NextResponse.json({ error: "Você não pode recomendar um álbum para si mesmo." }, { status: 400 });
  }

  const [toUser, album, mutual] = await Promise.all([
    prisma.user.findUnique({ where: { id: toUserId } }),
    prisma.album.findUnique({ where: { id: albumId } }),
    isMutualFollow(userId, toUserId),
  ]);
  if (!toUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (!album) return NextResponse.json({ error: "Álbum não encontrado." }, { status: 404 });
  if (!mutual) {
    return NextResponse.json(
      { error: "Vocês precisam se seguir mutuamente para trocar recomendações." },
      { status: 403 }
    );
  }

  const existingPending = await prisma.albumRecommendation.findFirst({
    where: {
      fromUserId: userId,
      toUserId,
      albumId,
      listenLogId: null,
      expiresAt: { gte: new Date() },
    },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Você já recomendou esse álbum para esse amigo recentemente." },
      { status: 409 }
    );
  }

  const now = new Date();
  const recommendation = await prisma.albumRecommendation.create({
    data: {
      fromUserId: userId,
      toUserId,
      albumId,
      message: message?.trim() ? message.trim() : null,
      createdAt: now,
      expiresAt: new Date(now.getTime() + RECOMMENDATION_WINDOW_MS),
    },
    include: {
      album: true,
      fromUser: { select: { id: true, name: true, avatarUrl: true } },
      toUser: { select: { id: true, name: true, avatarUrl: true } },
      shameNote: true,
    },
  });

  await notifyRecommended(userId, toUserId, albumId);

  return NextResponse.json({ recommendation: toRecommendationDTO(recommendation) });
}
