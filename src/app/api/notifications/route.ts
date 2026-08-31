import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import type { NotificationDTO } from "@/lib/types";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);

  const rows = await prisma.notification.findMany({
    where: { recipientId: userId },
    include: {
      actor: { select: { id: true, name: true, avatarUrl: true } },
      album: { select: { id: true, title: true, coverUrl: true } },
      list: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  const notifications: NotificationDTO[] = rows.map((n) => ({
    id: n.id,
    type: n.type as NotificationDTO["type"],
    read: n.read,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor,
    album: n.album,
    list: n.list,
  }));

  return NextResponse.json({ notifications });
}
