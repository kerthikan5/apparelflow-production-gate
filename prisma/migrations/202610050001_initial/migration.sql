-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cutting_supervisor', 'cutting_verifier', 'sewing_supervisor');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CUTTING_IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Signal" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "recipeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stdFabricYards" DECIMAL(10,4) NOT NULL,
    "wastageCap" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeComponent" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "piecesPerGarment" INTEGER NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "RecipeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingOrder" (
    "id" TEXT NOT NULL,
    "orderNo" SERIAL NOT NULL,
    "recipeId" TEXT NOT NULL,
    "targetQty" INTEGER NOT NULL,
    "fabricRollId" TEXT NOT NULL,
    "actualFabricYds" DECIMAL(12,4) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CUTTING_IN_PROGRESS',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "assemblyStartedAt" TIMESTAMP(3),

    CONSTRAINT "CuttingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "actualQty" INTEGER,
    "status" "Signal",

    CONSTRAINT "VerificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "rejectionNote" TEXT,
    "wastagePct" DECIMAL(14,4) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_recipeCode_key" ON "Recipe"("recipeCode");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeComponent_recipeId_componentName_key" ON "RecipeComponent"("recipeId", "componentName");

-- CreateIndex
CREATE UNIQUE INDEX "CuttingOrder_orderNo_key" ON "CuttingOrder"("orderNo");

-- CreateIndex
CREATE INDEX "CuttingOrder_status_createdAt_idx" ON "CuttingOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CuttingOrder_createdBy_idx" ON "CuttingOrder"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationItem_orderId_componentId_key" ON "VerificationItem"("orderId", "componentId");

-- CreateIndex
CREATE INDEX "VerificationLog_orderId_timestamp_idx" ON "VerificationLog"("orderId", "timestamp");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComponent" ADD CONSTRAINT "RecipeComponent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingOrder" ADD CONSTRAINT "CuttingOrder_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingOrder" ADD CONSTRAINT "CuttingOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationItem" ADD CONSTRAINT "VerificationItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CuttingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationItem" ADD CONSTRAINT "VerificationItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "RecipeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CuttingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
