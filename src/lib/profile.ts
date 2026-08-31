import { prisma } from "@/lib/prisma";
import { getPersonalStats } from "@/lib/stats";
import { getStreak } from "@/lib/streak";
import { getFriendship, getShameNotesForUser } from "@/lib/friendship";
import type { ListSummaryDTO, PublicProfileDTO } from "@/lib/types";

export async function getPublicProfile(
  viewerId: string,
  targetUserId: string
): Promise<PublicProfileDTO | null> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { favoriteAlbum: true },
  });
  if (!user) return null;

  const [followerCount, followingCount, isFollowingRow, theyFollowMeRow, pinnedLists, stats, streak, shameNotes] =
    await Promise.all([
      prisma.follow.count({ where: { followingId: targetUserId } }),
      prisma.follow.count({ where: { followerId: targetUserId } }),
      viewerId === targetUserId
        ? null
        : prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: targetUserId } },
          }),
      viewerId === targetUserId
        ? null
        : prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: targetUserId, followingId: viewerId } },
          }),
      prisma.pinnedList.findMany({
        where: { userId: targetUserId },
        orderBy: { position: "asc" },
        include: { list: { include: { entries: { orderBy: { position: "asc" }, include: { album: true } } } } },
      }),
      getPersonalStats(targetUserId),
      getStreak(targetUserId),
      getShameNotesForUser(targetUserId),
    ]);

  const isFollowing = isFollowingRow != null;
  const isMutualFollow = isFollowing && theyFollowMeRow != null;
  const friendship =
    isMutualFollow && viewerId !== targetUserId ? await getFriendship(viewerId, targetUserId) : null;

  const pinnedListDTOs: ListSummaryDTO[] = pinnedLists.map((p) => ({
    id: p.list.id,
    name: p.list.name,
    description: p.list.description,
    createdAt: p.list.createdAt.toISOString(),
    entryCount: p.list.entries.length,
    covers: p.list.entries.slice(0, 4).map((e) => e.album.coverUrl ?? ""),
  }));

  return {
    id: user.id,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    createdAt: user.createdAt.toISOString(),
    favoriteAlbum: user.favoriteAlbum
      ? {
          id: user.favoriteAlbum.id,
          mbid: user.favoriteAlbum.mbid,
          title: user.favoriteAlbum.title,
          artist: user.favoriteAlbum.artist,
          coverUrl: user.favoriteAlbum.coverUrl,
          releaseDate: user.favoriteAlbum.releaseDate,
        }
      : null,
    featuredTab: (user.featuredTab as PublicProfileDTO["featuredTab"]) ?? "diary",
    followerCount,
    followingCount,
    isFollowing,
    isMutualFollow,
    isSelf: viewerId === targetUserId,
    pinnedLists: pinnedListDTOs,
    stats,
    streak,
    friendship,
    shameNotes,
  };
}
