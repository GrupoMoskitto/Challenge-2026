/*
  Warnings:

  - The values [CONFIRMATION,REMINDER_2_DAYS,REMINDER_1_DAY] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[cpf]` on the table `Surgeon` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'ATTENTION_REQUIRED';

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('REMINDER_30D', 'REMINDER_7D', 'CONFIRMATION_48H', 'POST_OP_CONFIRMATION', 'LAST_ATTEMPT', 'NEW_LEAD', 'APPOINTMENT_CONFIRMED', 'SYSTEM_ERROR', 'NO_RESPONSE_48H');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PostOpStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "PostOpStatus" ADD VALUE 'ATTENTION_REQUIRED';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "riskUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "postOpId" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Surgeon" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "rg" TEXT;

-- AlterTable
ALTER TABLE "WhatsappSession" ADD COLUMN     "lastVerificationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SlotLock" (
    "id" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotLock_surgeonId_date_startTime_idx" ON "SlotLock"("surgeonId", "date", "startTime");

-- CreateIndex
CREATE INDEX "SlotLock_expiresAt_idx" ON "SlotLock"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_postOpId_idx" ON "Notification"("postOpId");

-- CreateIndex
CREATE UNIQUE INDEX "Surgeon_cpf_key" ON "Surgeon"("cpf");

-- CreateIndex
CREATE INDEX "Surgeon_cpf_idx" ON "Surgeon"("cpf");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_postOpId_fkey" FOREIGN KEY ("postOpId") REFERENCES "PostOp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
