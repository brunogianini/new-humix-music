-- CreateTable
CREATE TABLE "ListeningSessionVote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "winningAlbumId" TEXT,

    CONSTRAINT "ListeningSessionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionVoteCandidate" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionVoteCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionVoteBallot" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionVoteBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListeningSessionVote_sessionId_idx" ON "ListeningSessionVote"("sessionId");

-- CreateIndex
CREATE INDEX "SessionVoteCandidate_voteId_idx" ON "SessionVoteCandidate"("voteId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionVoteCandidate_voteId_albumId_key" ON "SessionVoteCandidate"("voteId", "albumId");

-- CreateIndex
CREATE INDEX "SessionVoteBallot_voteId_idx" ON "SessionVoteBallot"("voteId");

-- CreateIndex
CREATE INDEX "SessionVoteBallot_candidateId_idx" ON "SessionVoteBallot"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionVoteBallot_voteId_userId_key" ON "SessionVoteBallot"("voteId", "userId");

-- AddForeignKey
ALTER TABLE "ListeningSessionVote" ADD CONSTRAINT "ListeningSessionVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ListeningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSessionVote" ADD CONSTRAINT "ListeningSessionVote_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVoteCandidate" ADD CONSTRAINT "SessionVoteCandidate_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "ListeningSessionVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVoteCandidate" ADD CONSTRAINT "SessionVoteCandidate_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVoteCandidate" ADD CONSTRAINT "SessionVoteCandidate_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVoteBallot" ADD CONSTRAINT "SessionVoteBallot_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "ListeningSessionVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVoteBallot" ADD CONSTRAINT "SessionVoteBallot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SessionVoteCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionVoteBallot" ADD CONSTRAINT "SessionVoteBallot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
