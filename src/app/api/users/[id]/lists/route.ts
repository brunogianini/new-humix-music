import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import type { ListSummaryDTO } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;

  const lists = await prisma.list.findMany({
    where: { userId: id },
    include: { entries: { orderBy: { position: "asc" }, include: { album: true } } },
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
