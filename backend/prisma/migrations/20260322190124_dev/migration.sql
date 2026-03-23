-- AlterTable
ALTER TABLE "Admission" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "parentEmail" TEXT,
ADD COLUMN     "parentFirstName" TEXT,
ADD COLUMN     "parentLastName" TEXT,
ADD COLUMN     "parentPhone" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "previousSchool" TEXT,
ADD COLUMN     "state" TEXT;
