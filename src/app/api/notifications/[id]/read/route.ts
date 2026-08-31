import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const notification = await prisma.notification.findFirst({ where: { id, recipientId: userId } });
  if (!notification) {
    return NextResponse.json({ error: "Notificação não encontrada." }, { status: 404 });
  }

  await prisma.notification.update({ where: { id }, data: { read: true } });

  return NextResponse.json({ ok: true });
}
