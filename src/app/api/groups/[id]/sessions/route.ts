import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { sessionCreateSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { SESSION_INCLUDE, isGroupMember, pickAlbumForGroup, toSessionDTO } from "@/lib/groups";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const scheduledFor = new Date(parsed.data.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const group = await prisma.listeningGroup.findUnique({
    where: { id: groupId },
    select: { createdById: true, _count: { select: { members: true } } },
  });
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  if (!(await isGroupMember(groupId, userId))) {
    return NextResponse.json({ error: "Você não é membro desse grupo." }, { status: 403 });
  }

  const albumId = await pickAlbumForGroup(groupId);
  if (!albumId) {
    return NextResponse.json(
      {
        error:
          "Ninguém no grupo tem álbuns curtidos, marcados pra ouvir ou registrados ainda — não há o que sortear.",
      },
      { status: 409 }
    );
  }

  const session = await prisma.listeningSession.create({
    data: { groupId, scheduledFor, albumId, createdById: userId },
    include: SESSION_INCLUDE,
  });

  return NextResponse.json({
    session: toSessionDTO(session, userId, group.createdById, group._count.members),
  });
}
