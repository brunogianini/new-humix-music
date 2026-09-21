import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { canManageSession, getSessionDTO, pickAlbumForGroup } from "@/lib/groups";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id: groupId, sessionId } = await params;

  const [group, session] = await Promise.all([
    prisma.listeningGroup.findUnique({ where: { id: groupId }, select: { createdById: true } }),
    prisma.listeningSession.findFirst({
      where: { id: sessionId, groupId },
      include: { votes: { where: { closedAt: null }, select: { id: true } } },
    }),
  ]);
  if (!group) return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  if (!session) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  if (!canManageSession(session, group.createdById, userId)) {
    return NextResponse.json(
      { error: "Só quem marcou a sessão ou o dono do grupo pode trocar o álbum." },
      { status: 403 }
    );
  }
  if (session.votes.length > 0) {
    return NextResponse.json(
      { error: "Cancele a votação em andamento antes de sortear outro álbum." },
      { status: 409 }
    );
  }

  const albumId = await pickAlbumForGroup(groupId, session.albumId);
  if (!albumId) {
    return NextResponse.json(
      { error: "Não há álbuns suficientes no grupo pra sortear outro." },
      { status: 409 }
    );
  }
  if (albumId === session.albumId) {
    return NextResponse.json(
      { error: "Não há outro álbum diferente pra sortear no grupo." },
      { status: 409 }
    );
  }

  await prisma.listeningSession.update({ where: { id: sessionId }, data: { albumId } });

  const dto = await getSessionDTO(sessionId, userId);
  return NextResponse.json({ session: dto });
}
