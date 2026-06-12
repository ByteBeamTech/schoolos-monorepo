-- CreateTable
CREATE TABLE "SubjectMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyPeriods" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectMapping_tenantId_idx" ON "SubjectMapping"("tenantId");

-- CreateIndex
CREATE INDEX "SubjectMapping_classId_idx" ON "SubjectMapping"("classId");

-- CreateIndex
CREATE INDEX "SubjectMapping_subjectId_idx" ON "SubjectMapping"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectMapping_tenantId_classId_subjectId_key" ON "SubjectMapping"("tenantId", "classId", "subjectId");

-- AddForeignKey
ALTER TABLE "SubjectMapping" ADD CONSTRAINT "SubjectMapping_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMapping" ADD CONSTRAINT "SubjectMapping_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
