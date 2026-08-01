-- AlterTable
ALTER TABLE `Page` 
  DROP COLUMN `published`,
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `publishedAt` DATETIME(3) NULL,
  ADD INDEX `Page_status_publishedAt_idx`(`status`, `publishedAt`);

-- AlterTable
ALTER TABLE `PageRevision` 
  DROP COLUMN `published`,
  ADD COLUMN `status` VARCHAR(191) NOT NULL,
  ADD COLUMN `publishedAt` DATETIME(3) NULL;