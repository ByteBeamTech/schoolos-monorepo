/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,phone]` on the table `Guardian` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Guardian_tenantId_phone_key" ON "Guardian"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "GuardianStudent_guardianId_idx" ON "GuardianStudent"("guardianId");

-- CreateIndex
CREATE INDEX "Student_firstName_lastName_idx" ON "Student"("firstName", "lastName");
