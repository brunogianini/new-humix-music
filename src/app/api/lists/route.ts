import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { listCreateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { notifyFollowersOfNewList } from "@/lib/notify";
import type { ListSummaryDTO } from "@/lib/types";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const lists = await prisma.list.findMany({
    where: { userId },
    include: {
      entries: {
        orderBy: { position: "asc" },
        include: { album: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result: ListSummaryDTO[] = lists.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    createdAt: l.createdAt.toISOString(),
    entryCount: l.entries.length,
    covers: l.entries.slice(0, 4).map((e) => e.album.coverUrl ?? ""),
  }));

  return NextResponse.json({ lists: result });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = listCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const list = await prisma.list.create({
    data: { userId, name: parsed.data.name, description: parsed.data.description ?? null },
  });

  await notifyFollowersOfNewList(userId, list.id);

  return NextResponse.json({ list });
}
