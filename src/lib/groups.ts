import { prisma } from "@/lib/prisma";
import type {
  AlbumDTO,
  GroupAlbumRatingDTO,
  GroupDetailDTO,
  GroupMemberDTO,
  GroupSessionDTO,
  GroupSummaryDTO,
} from "@/lib/types";

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const member = await prisma.listeningGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return member != null;
}

// Random pick, uniform across distinct albums (not weighted by how many
// members like/logged each one), from the pool of albums the group's
// members have liked, marked "quero ouvir", or already logged.
export async function pickAlbumForGroup(groupId: string): Promise<string | null> {
  const members = await prisma.listeningGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return null;

  const [statuses, logs] = await Promise.all([
    prisma.albumStatus.findMany({
      where: { userId: { in: memberIds }, OR: [{ liked: true }, { wantToListen: true }] },
      select: { albumId: true },
      distinct: ["albumId"],
    }),
    prisma.listenLog.findMany({
      where: { userId: { in: memberIds } },
      select: { albumId: true },
      distinct: ["albumId"],
    }),
  ]);

  const pool = [...new Set([...statuses.map((s) => s.albumId), ...logs.map((l) => l.albumId)])];
  if (pool.length === 0) return null;

  return pool[Math.floor(Math.random() * pool.length)];
}

function toAlbumDTO(a: {
  id: string;
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
}): AlbumDTO {
  return {
    id: a.id,
    mbid: a.mbid,
    title: a.title,
    artist: a.artist,
    coverUrl: a.coverUrl,
    releaseDate: a.releaseDate,
  };
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

type SessionRow = {
  id: string;
  scheduledFor: Date;
  createdAt: Date;
  album: {
    id: string;
    mbid: string;
    title: string;
    artist: string;
    coverUrl: string | null;
    releaseDate: string | null;
  };
  createdBy: { id: string; name: string | null; avatarUrl: string | null };
  ratings: { userId: string; rating: number; review: string | null }[];
};

export function toSessionDTO(session: SessionRow, viewerId: string): GroupSessionDTO {
  return {
    id: session.id,
    scheduledFor: session.scheduledFor.toISOString(),
    createdAt: session.createdAt.toISOString(),
    album: toAlbumDTO(session.album),
    createdBy: session.createdBy,
    ratings: session.ratings,
    avgRating: average(session.ratings.map((r) => r.rating)),
    myRating: session.ratings.find((r) => r.userId === viewerId)?.rating ?? null,
  };
}

// Averages every rating a group's members gave an album across every
// session that album came up in for this group — not just its most recent
// session — since the random pick can land on the same album more than once.
function toAlbumRatings(sessions: SessionRow[]): GroupAlbumRatingDTO[] {
  const byAlbum = new Map<
    string,
    { album: SessionRow["album"]; ratings: number[]; sessionIds: Set<string> }
  >();

  for (const session of sessions) {
    const entry = byAlbum.get(session.album.id) ?? {
      album: session.album,
      ratings: [],
      sessionIds: new Set<string>(),
    };
    entry.ratings.push(...session.ratings.map((r) => r.rating));
    entry.sessionIds.add(session.id);
    byAlbum.set(session.album.id, entry);
  }

  return [...byAlbum.values()]
    .map((e) => ({
      album: toAlbumDTO(e.album),
      avgRating: average(e.ratings),
      ratingCount: e.ratings.length,
      sessionCount: e.sessionIds.size,
    }))
    .sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
}

const MEMBER_SELECT = { id: true, name: true, avatarUrl: true } as const;

const SESSION_INCLUDE = {
  album: true,
  createdBy: { select: MEMBER_SELECT },
  ratings: { select: { userId: true, rating: true, review: true } },
} as const;

export async function getGroupDetail(
  groupId: string,
  viewerId: string
): Promise<GroupDetailDTO | null> {
  const group = await prisma.listeningGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: MEMBER_SELECT } }, orderBy: { joinedAt: "asc" } },
      sessions: { include: SESSION_INCLUDE, orderBy: { scheduledFor: "desc" } },
    },
  });
  if (!group) return null;
  if (!group.members.some((m) => m.userId === viewerId)) return null;

  const members: GroupMemberDTO[] = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt.toISOString(),
    createdById: group.createdById,
    isOwner: group.createdById === viewerId,
    members,
    sessions: group.sessions.map((s) => toSessionDTO(s, viewerId)),
    albumRatings: toAlbumRatings(group.sessions),
  };
}

export async function listGroupsForUser(userId: string): Promise<GroupSummaryDTO[]> {
  const memberships = await prisma.listeningGroupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: { select: { avatarUrl: true } } }, take: 5 },
          _count: { select: { members: true, sessions: true } },
        },
      },
    },
    orderBy: { group: { createdAt: "desc" } },
  });

  return memberships.map(({ group }) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt.toISOString(),
    createdById: group.createdById,
    memberCount: group._count.members,
    sessionCount: group._count.sessions,
    avatarUrls: group.members.map((m) => m.user.avatarUrl),
  }));
}
