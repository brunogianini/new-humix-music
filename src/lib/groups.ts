import { prisma } from "@/lib/prisma";
import type {
  AlbumDTO,
  GroupAlbumRatingDTO,
  GroupDetailDTO,
  GroupMemberDTO,
  GroupSessionDTO,
  GroupSummaryDTO,
  SessionVoteDTO,
} from "@/lib/types";

export async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const member = await prisma.listeningGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  return member != null;
}

// Only whoever created the session, or the group's owner, can reroll it or
// open/cancel a vote for it.
export function canManageSession(
  session: { createdById: string },
  groupCreatedById: string,
  userId: string
): boolean {
  return session.createdById === userId || groupCreatedById === userId;
}

// Random pick, uniform across distinct albums (not weighted by how many
// members like/logged each one), from the pool of albums the group's
// members have liked, marked "quero ouvir", or already logged. Pass
// `excludeAlbumId` to try to land on a different album than the current one
// (falls back to it if it's the only option in the pool).
export async function pickAlbumForGroup(
  groupId: string,
  excludeAlbumId?: string
): Promise<string | null> {
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

  if (excludeAlbumId) {
    const withoutCurrent = pool.filter((id) => id !== excludeAlbumId);
    if (withoutCurrent.length > 0) {
      return withoutCurrent[Math.floor(Math.random() * withoutCurrent.length)];
    }
  }

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

const MEMBER_SELECT = { id: true, name: true, avatarUrl: true } as const;

const VOTE_INCLUDE = {
  openedBy: { select: MEMBER_SELECT },
  candidates: { include: { album: true, proposedBy: { select: MEMBER_SELECT } }, orderBy: { createdAt: "asc" } },
  ballots: { select: { candidateId: true, userId: true } },
} as const;

export const SESSION_INCLUDE = {
  album: true,
  createdBy: { select: MEMBER_SELECT },
  ratings: { select: { userId: true, rating: true, review: true } },
  votes: { where: { closedAt: null }, take: 1, include: VOTE_INCLUDE },
} as const;

type VoteRow = {
  id: string;
  openedBy: { id: string; name: string | null; avatarUrl: string | null };
  createdAt: Date;
  candidates: {
    id: string;
    album: {
      id: string;
      mbid: string;
      title: string;
      artist: string;
      coverUrl: string | null;
      releaseDate: string | null;
    };
    proposedBy: { id: string; name: string | null; avatarUrl: string | null };
  }[];
  ballots: { candidateId: string; userId: string }[];
};

type SessionRow = {
  id: string;
  scheduledFor: Date;
  createdAt: Date;
  createdById: string;
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
  votes: VoteRow[];
};

function toVoteDTO(vote: VoteRow, viewerId: string, totalMembers: number): SessionVoteDTO {
  const countByCandidate = new Map<string, number>();
  for (const b of vote.ballots) {
    countByCandidate.set(b.candidateId, (countByCandidate.get(b.candidateId) ?? 0) + 1);
  }
  const myCandidateId = vote.ballots.find((b) => b.userId === viewerId)?.candidateId ?? null;

  return {
    id: vote.id,
    openedBy: vote.openedBy,
    createdAt: vote.createdAt.toISOString(),
    totalMembers,
    ballotsCast: vote.ballots.length,
    candidates: vote.candidates.map((c) => ({
      id: c.id,
      album: toAlbumDTO(c.album),
      proposedBy: c.proposedBy,
      voteCount: countByCandidate.get(c.id) ?? 0,
      votedByMe: myCandidateId === c.id,
    })),
  };
}

export function toSessionDTO(
  session: SessionRow,
  viewerId: string,
  groupCreatedById: string,
  totalMembers: number
): GroupSessionDTO {
  const openVote = session.votes[0];
  return {
    id: session.id,
    scheduledFor: session.scheduledFor.toISOString(),
    createdAt: session.createdAt.toISOString(),
    album: toAlbumDTO(session.album),
    createdBy: session.createdBy,
    ratings: session.ratings,
    avgRating: average(session.ratings.map((r) => r.rating)),
    myRating: session.ratings.find((r) => r.userId === viewerId)?.rating ?? null,
    canManage: canManageSession(session, groupCreatedById, viewerId),
    vote: openVote ? toVoteDTO(openVote, viewerId, totalMembers) : null,
  };
}

// Re-fetches one session with everything toSessionDTO needs. Used after any
// mutation (reroll, vote start/cancel, candidate propose, ballot cast) so
// the caller can hand the client a fresh session without a full group reload.
export async function getSessionDTO(
  sessionId: string,
  viewerId: string
): Promise<GroupSessionDTO | null> {
  const session = await prisma.listeningSession.findUnique({
    where: { id: sessionId },
    include: SESSION_INCLUDE,
  });
  if (!session) return null;

  const group = await prisma.listeningGroup.findUnique({
    where: { id: session.groupId },
    select: { createdById: true, _count: { select: { members: true } } },
  });
  if (!group) return null;

  return toSessionDTO(session, viewerId, group.createdById, group._count.members);
}

// Averages every rating a group's members gave an album across every
// session that album came up in for this group — not just its most recent
// session — since the random pick can land on the same album more than once.
function toAlbumRatings(
  sessions: { id: string; album: SessionRow["album"]; ratings: { rating: number }[] }[]
): GroupAlbumRatingDTO[] {
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
    sessions: group.sessions.map((s) => toSessionDTO(s, viewerId, group.createdById, members.length)),
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

// Closes the vote if every group member has cast a ballot: the candidate
// with the most ballots wins (ties broken at random) and becomes the
// session's album. No-op (returns false) if the vote is still short of
// ballots. Must run right after a ballot is cast.
export async function resolveVoteIfComplete(voteId: string): Promise<boolean> {
  const vote = await prisma.listeningSessionVote.findUnique({
    where: { id: voteId },
    include: {
      ballots: { select: { candidateId: true } },
      session: { include: { group: { select: { _count: { select: { members: true } } } } } },
    },
  });
  if (!vote || vote.closedAt) return false;

  const totalMembers = vote.session.group._count.members;
  if (vote.ballots.length < totalMembers) return false;

  const countByCandidate = new Map<string, number>();
  for (const b of vote.ballots) {
    countByCandidate.set(b.candidateId, (countByCandidate.get(b.candidateId) ?? 0) + 1);
  }
  const maxCount = Math.max(...countByCandidate.values());
  const winners = [...countByCandidate.entries()].filter(([, c]) => c === maxCount).map(([id]) => id);
  const winningCandidateId = winners[Math.floor(Math.random() * winners.length)];

  const winningCandidate = await prisma.sessionVoteCandidate.findUniqueOrThrow({
    where: { id: winningCandidateId },
    select: { albumId: true },
  });

  await prisma.$transaction([
    prisma.listeningSessionVote.update({
      where: { id: voteId },
      data: { closedAt: new Date(), winningAlbumId: winningCandidate.albumId },
    }),
    prisma.listeningSession.update({
      where: { id: vote.sessionId },
      data: { albumId: winningCandidate.albumId },
    }),
  ]);

  return true;
}
