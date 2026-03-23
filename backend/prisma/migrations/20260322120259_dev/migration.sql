-- CreateTable
CREATE TABLE "TeacherSubjectPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherSubjectPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherSubjectPreference_tenantId_staffId_idx" ON "TeacherSubjectPreference"("tenantId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSubjectPreference_tenantId_staffId_subjectId_key" ON "TeacherSubjectPreference"("tenantId", "staffId", "subjectId");
