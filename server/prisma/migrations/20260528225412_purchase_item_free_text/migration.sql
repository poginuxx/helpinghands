-- DropForeignKey
ALTER TABLE "PurchaseItem" DROP CONSTRAINT "PurchaseItem_medicineId_fkey";

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "medicineBrandName" TEXT,
ADD COLUMN     "medicineName" TEXT,
ADD COLUMN     "medicineStrength" TEXT,
ALTER COLUMN "medicineId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
