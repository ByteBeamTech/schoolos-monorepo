-- CreateTable
CREATE TABLE "PlatformInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "department" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvitation_token_key" ON "PlatformInvitation"("token");

-- CreateIndex
CREATE INDEX "PlatformInvitation_email_idx" ON "PlatformInvitation"("email");

-- CreateIndex
CREATE INDEX "PlatformInvitation_token_idx" ON "PlatformInvitation"("token");

-- CreateIndex
CREATE INDEX "PlatformInvitation_status_idx" ON "PlatformInvitation"("status");
