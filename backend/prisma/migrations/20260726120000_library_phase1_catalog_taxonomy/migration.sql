-- ADR-LIB-001 Phase 1: Library catalog taxonomy + per-branch config.
-- Pure additive migration -- no existing Book/BookIssue column is
-- dropped or altered in a breaking way. See
-- docs/architecture/library/LIBRARY_DOMAIN_ARCHITECTURE_FREEZE.md

-- CreateTable
CREATE TABLE "BookCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BookCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookAuthor" (
    "bookId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "BookAuthor_pkey" PRIMARY KEY ("bookId","authorId")
);

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelf" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryBranchSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "loanDurationDays" INTEGER NOT NULL DEFAULT 14,
    "maxRenewals" INTEGER NOT NULL DEFAULT 2,
    "maxActiveLoansPerBorrower" INTEGER NOT NULL DEFAULT 1,
    "reservationHoldHours" INTEGER NOT NULL DEFAULT 48,
    "fineRatePerDay" DECIMAL(10,2) NOT NULL DEFAULT 2.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryBranchSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "publisherId" TEXT;

-- CreateIndex
CREATE INDEX "BookCategory_tenantId_idx" ON "BookCategory"("tenantId");

-- CreateIndex
CREATE INDEX "BookCategory_tenantId_parentId_idx" ON "BookCategory"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCategory_tenantId_parentId_name_key" ON "BookCategory"("tenantId", "parentId", "name");

-- CreateIndex
CREATE INDEX "Author_tenantId_idx" ON "Author"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Author_tenantId_name_key" ON "Author"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Publisher_tenantId_idx" ON "Publisher"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_tenantId_name_key" ON "Publisher"("tenantId", "name");

-- CreateIndex
CREATE INDEX "BookAuthor_authorId_idx" ON "BookAuthor"("authorId");

-- CreateIndex
CREATE INDEX "Rack_tenantId_branchId_idx" ON "Rack"("tenantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Rack_tenantId_branchId_code_key" ON "Rack"("tenantId", "branchId", "code");

-- CreateIndex
CREATE INDEX "Shelf_tenantId_idx" ON "Shelf"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Shelf_rackId_code_key" ON "Shelf"("rackId", "code");

-- CreateIndex
CREATE INDEX "LibraryBranchSettings_tenantId_idx" ON "LibraryBranchSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryBranchSettings_tenantId_branchId_key" ON "LibraryBranchSettings"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "Book_categoryId_idx" ON "Book"("categoryId");

-- CreateIndex
CREATE INDEX "Book_publisherId_idx" ON "Book"("publisherId");

-- AddForeignKey
ALTER TABLE "BookCategory" ADD CONSTRAINT "BookCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAuthor" ADD CONSTRAINT "BookAuthor_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAuthor" ADD CONSTRAINT "BookAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rack" ADD CONSTRAINT "Rack_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryBranchSettings" ADD CONSTRAINT "LibraryBranchSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BookCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
