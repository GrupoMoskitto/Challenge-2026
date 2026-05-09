-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CONTRACT_SIGNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'READ';

-- AlterEnum
ALTER TYPE "PostOpType" ADD VALUE 'PHONE_CALL';

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "patientId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileType" TEXT,
ADD COLUMN     "fileUrl" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "howMet" TEXT,
ADD COLUMN     "sex" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Surgeon" ADD COLUMN     "appointmentDuration" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "ExtraAvailabilitySlot" (
    "id" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "surgeonId" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "returnDeadline" TIMESTAMP(3),
    "status" "BudgetStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetFollowUp" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "respondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "responseDeadline" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sector" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "solution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtraAvailabilitySlot_surgeonId_idx" ON "ExtraAvailabilitySlot"("surgeonId");

-- CreateIndex
CREATE INDEX "ExtraAvailabilitySlot_date_idx" ON "ExtraAvailabilitySlot"("date");

-- CreateIndex
CREATE INDEX "ScheduleBlock_surgeonId_idx" ON "ScheduleBlock"("surgeonId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_startDate_idx" ON "ScheduleBlock"("startDate");

-- CreateIndex
CREATE INDEX "Budget_patientId_idx" ON "Budget"("patientId");

-- CreateIndex
CREATE INDEX "Budget_surgeonId_idx" ON "Budget"("surgeonId");

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE INDEX "BudgetFollowUp_budgetId_idx" ON "BudgetFollowUp"("budgetId");

-- CreateIndex
CREATE INDEX "Complaint_patientId_idx" ON "Complaint"("patientId");

-- CreateIndex
CREATE INDEX "Complaint_status_idx" ON "Complaint"("status");

-- CreateIndex
CREATE INDEX "Complaint_area_idx" ON "Complaint"("area");

-- CreateIndex
CREATE INDEX "Treatment_complaintId_idx" ON "Treatment"("complaintId");

-- CreateIndex
CREATE INDEX "Treatment_date_idx" ON "Treatment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappSession_jid_key" ON "WhatsappSession"("jid");

-- CreateIndex
CREATE INDEX "WhatsappSession_jid_idx" ON "WhatsappSession"("jid");

-- CreateIndex
CREATE INDEX "WhatsappSession_expiresAt_idx" ON "WhatsappSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_patientId_idx" ON "AuditLog"("patientId");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");

-- CreateIndex
CREATE INDEX "Patient_deletedAt_idx" ON "Patient"("deletedAt");

-- AddForeignKey
ALTER TABLE "ExtraAvailabilitySlot" ADD CONSTRAINT "ExtraAvailabilitySlot_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "Surgeon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetFollowUp" ADD CONSTRAINT "BudgetFollowUp_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
