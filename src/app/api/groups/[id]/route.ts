import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { getGroupDetail } from "@/lib/groups";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const group = await getGroupDetail(id, userId);
  if (!group) {
    return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ group });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const result = await prisma.listeningGroup.deleteMany({ where: { id, createdById: userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
