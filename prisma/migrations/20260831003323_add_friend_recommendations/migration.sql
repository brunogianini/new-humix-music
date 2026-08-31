-- CreateTable
CREATE TABLE "AlbumRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "listenLogId" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "AlbumRecommendation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumRecommendation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumRecommendation_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumRecommendation_listenLogId_fkey" FOREIGN KEY ("listenLogId") REFERENCES "ListenLog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShameNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShameNote_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AlbumRecommendation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShameNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShameNote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AlbumRecommendation_toUserId_idx" ON "AlbumRecommendation"("toUserId");

-- CreateIndex
CREATE INDEX "AlbumRecommendation_fromUserId_idx" ON "AlbumRecommendation"("fromUserId");

-- CreateIndex
CREATE INDEX "AlbumRecommendation_albumId_idx" ON "AlbumRecommendation"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "ShameNote_recommendationId_key" ON "ShameNote"("recommendationId");

-- CreateIndex
CREATE INDEX "ShameNote_targetUserId_idx" ON "ShameNote"("targetUserId");
