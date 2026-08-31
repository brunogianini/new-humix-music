import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { logPatchSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = logPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rating, review, listenedOn, relisten } = parsed.data;

  const updated = await prisma.listenLog.updateMany({
    where: { id, userId },
    data: {
      ...(rating !== undefined ? { rating } : {}),
      ...(review !== undefined ? { review: review?.trim() ? review.trim() : null } : {}),
      ...(listenedOn !== undefined ? { listenedOn: new Date(listenedOn) } : {}),
      ...(relisten !== undefined ? { relisten } : {}),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

  const log = await prisma.listenLog.findUnique({ where: { id } });
  return NextResponse.json({ log });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  await prisma.listenLog.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
