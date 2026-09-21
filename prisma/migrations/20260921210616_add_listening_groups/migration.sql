-- CreateTable
CREATE TABLE "ListeningGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningSession" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "albumId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningSessionRating" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningSessionRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningGroup_createdById_idx" ON "ListeningGroup"("createdById");

-- CreateIndex
CREATE INDEX "ListeningGroupMember_userId_idx" ON "ListeningGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListeningGroupMember_groupId_userId_key" ON "ListeningGroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "ListeningSession_groupId_idx" ON "ListeningSession"("groupId");

-- CreateIndex
CREATE INDEX "ListeningSession_albumId_idx" ON "ListeningSession"("albumId");

-- CreateIndex
CREATE INDEX "ListeningSessionRating_sessionId_idx" ON "ListeningSessionRating"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ListeningSessionRating_sessionId_userId_key" ON "ListeningSessionRating"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "ListeningGroup" ADD CONSTRAINT "ListeningGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningGroupMember" ADD CONSTRAINT "ListeningGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ListeningGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningGroupMember" ADD CONSTRAINT "ListeningGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSession" ADD CONSTRAINT "ListeningSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ListeningGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSession" ADD CONSTRAINT "ListeningSession_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSession" ADD CONSTRAINT "ListeningSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSessionRating" ADD CONSTRAINT "ListeningSessionRating_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ListeningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSessionRating" ADD CONSTRAINT "ListeningSessionRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
