/*
  Warnings:

  - The primary key for the `Location` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Location` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Location_userId_key";

-- DropIndex
DROP INDEX "User_email_username_key";

-- AlterTable
ALTER TABLE "Location" DROP CONSTRAINT "Location_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Location_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "username" DROP DEFAULT;
