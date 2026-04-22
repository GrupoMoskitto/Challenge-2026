/*
  Warnings:

  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('WHATSAPP', 'CALL', 'EMAIL');

-- CreateEnum
CREATE TYPE "ContactDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'ANSWERED', 'MISSED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'TERM', 'EXAM', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'SIGNED', 'UPLOADED');

-- CreateEnum
CREATE TYPE "PostOpType" AS ENUM ('RETURN', 'REPAIR');

-- CreateEnum
CREATE TYPE "PostOpStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'PENDING');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "preferredDoctor" TEXT,
ADD COLUMN     "procedure" TEXT,
ADD COLUMN     "whatsappActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ContactType" NOT NULL,
    "direction" "ContactDirection" NOT NULL,
    "status" "ContactStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostOp" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "PostOpType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PostOpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostOp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "triggerDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_leadId_idx" ON "Contact"("leadId");

-- CreateIndex
CREATE INDEX "Contact_date_idx" ON "Contact"("date");

-- CreateIndex
CREATE INDEX "Document_patientId_idx" ON "Document"("patientId");

-- CreateIndex
CREATE INDEX "PostOp_patientId_idx" ON "PostOp"("patientId");

-- CreateIndex
CREATE INDEX "PostOp_date_idx" ON "PostOp"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_name_key" ON "MessageTemplate"("name");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostOp" ADD CONSTRAINT "PostOp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
