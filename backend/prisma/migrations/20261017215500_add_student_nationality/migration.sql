-- Add the student nationality field introduced in the Student Prisma model.
-- Nullable preserves existing student records; the schema default applies to
-- newly created rows when the field is omitted.
ALTER TABLE "Student" ADD COLUMN "nationality" TEXT DEFAULT 'Indian';
