import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { pinnedListsUpdateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const pinned = await prisma.pinnedList.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    select: { listId: true },
  });

  return NextResponse.json({ listIds: pinned.map((p) => p.listId) });
}

export async function PUT(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = pinnedListsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { listIds } = parsed.data;
  if (listIds.length > 0) {
    const owned = await prisma.list.count({ where: { id: { in: listIds }, userId } });
    if (owned !== listIds.length) {
      return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    }
  }

  await prisma.$transaction([
    prisma.pinnedList.deleteMany({ where: { userId } }),
    prisma.pinnedList.createMany({
      data: listIds.map((listId, position) => ({ userId, listId, position })),
    }),
  ]);

  return NextResponse.json({ listIds });
}
