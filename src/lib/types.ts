export type AlbumDTO = {
  id: string;
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
};

export type AlbumWithStats = AlbumDTO & {
  liked: boolean;
  wantToListen: boolean;
  // Viewer's own average rating across their diary logs for this album.
  avgRating: number | null;
  logCount: number; // viewer's own log count
  lastListenedOn: string | null;
  communityAvgRating: number | null; // pooled average across all users' ratings
  communityLogCount: number; // number of distinct users contributing to communityAvgRating
};

export type TrackDTO = {
  id: string;
  title: string;
  trackNumber: number;
  durationMs: number | null;
};

export type RelatedAlbumsDTO = {
  mode: "similar" | "discovery" | "neutral";
  albums: AlbumDTO[];
};

// Personalized picks derived from the viewer's own listening history — not
// to be confused with RecommendationDTO, which is a friend-to-friend album
// dare (see the Amigos tab).
export type ForYouDTO = {
  mode: "personalized" | "trending";
  albums: AlbumDTO[];
};

export type DiaryEntryDTO = {
  id: string;
  albumId: string;
  rating: number | null;
  review: string | null;
  listenedOn: string;
  relisten: boolean;
  createdAt: string;
  album: AlbumDTO;
};

export type ListSummaryDTO = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  entryCount: number;
  covers: string[];
};

export type ListDetailDTO = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  entries: {
    id: string;
    addedAt: string;
    album: AlbumWithStats;
  }[];
};

export type StatsDTO = {
  totalLogs: number;
  distinctAlbums: number;
  distinctArtists: number;
  avgRating: number | null;
  ratingDistribution: number[]; // index 0..10 -> half-star count buckets
  topArtists: { artist: string; count: number }[];
  logsThisYear: number;
  likedCount: number;
  wantToListenCount: number;
};

export type StreakDTO = {
  days: { date: string; count: number }[]; // last 371 days, chronological
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
};

export type NotificationDTO = {
  id: string;
  type:
    | "FOLLOW"
    | "LISTEN_LOG"
    | "LIST_CREATED"
    | "RECOMMENDATION"
    | "RECOMMENDATION_COMPLETED"
    | "SHAME_NOTE";
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string | null; avatarUrl: string | null };
  album: { id: string; title: string; coverUrl: string | null } | null;
  list: { id: string; name: string } | null;
};

export type RecommendationStatus = "PENDING" | "COMPLETED" | "EXPIRED" | "SHAMED";

export type RecommendationDTO = {
  id: string;
  status: RecommendationStatus;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  message: string | null;
  album: AlbumDTO;
  fromUser: { id: string; name: string | null; avatarUrl: string | null };
  toUser: { id: string; name: string | null; avatarUrl: string | null };
  shameNote: { id: string; text: string; createdAt: string } | null;
};

export type FriendshipDTO = { points: number; streak: number };

export type ShameNoteDTO = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };
};

export type UserSummaryDTO = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  isFollowing: boolean;
  followerCount: number;
};

export type PublicProfileDTO = {
  id: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  favoriteAlbum: AlbumDTO | null;
  featuredTab: "diary" | "lists" | "stats";
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isMutualFollow: boolean;
  isSelf: boolean;
  pinnedLists: ListSummaryDTO[];
  stats: StatsDTO;
  streak: StreakDTO;
  friendship: FriendshipDTO | null;
  shameNotes: ShameNoteDTO[];
};

export type PlatformStatsDTO = {
  topAlbumsByYear: {
    year: number;
    album: AlbumDTO;
    communityAvgRating: number;
    communityLogCount: number;
  }[];
  myTopAlbum: { album: AlbumDTO; rating: number } | null;
  topArtist: { artist: string; communityAvgRating: number; totalLogs: number } | null;
  mostLoggedAlbum: { album: AlbumDTO; logCount: number } | null;
  highestRatedAlbum: {
    album: AlbumDTO;
    communityAvgRating: number;
    communityLogCount: number;
  } | null;
};
