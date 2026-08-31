/*
  Warnings:

  - Added the required column `userId` to the `AlbumStatus` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `List` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ListenLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "scope" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AlbumStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "wantToListen" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlbumStatus_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlbumStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AlbumStatus" ("albumId", "id", "liked", "updatedAt", "wantToListen") SELECT "albumId", "id", "liked", "updatedAt", "wantToListen" FROM "AlbumStatus";
DROP TABLE "AlbumStatus";
ALTER TABLE "new_AlbumStatus" RENAME TO "AlbumStatus";
CREATE UNIQUE INDEX "AlbumStatus_albumId_userId_key" ON "AlbumStatus"("albumId", "userId");
CREATE TABLE "new_List" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_List" ("createdAt", "description", "id", "name") SELECT "createdAt", "description", "id", "name" FROM "List";
DROP TABLE "List";
ALTER TABLE "new_List" RENAME TO "List";
CREATE INDEX "List_userId_idx" ON "List"("userId");
CREATE TABLE "new_ListenLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER,
    "review" TEXT,
    "listenedOn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relisten" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListenLog_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListenLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ListenLog" ("albumId", "createdAt", "id", "listenedOn", "rating", "relisten", "review") SELECT "albumId", "createdAt", "id", "listenedOn", "rating", "relisten", "review" FROM "ListenLog";
DROP TABLE "ListenLog";
ALTER TABLE "new_ListenLog" RENAME TO "ListenLog";
CREATE INDEX "ListenLog_userId_idx" ON "ListenLog"("userId");
CREATE INDEX "ListenLog_albumId_idx" ON "ListenLog"("albumId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccount_userId_provider_key" ON "ExternalAccount"("userId", "provider");
