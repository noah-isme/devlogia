-- AlterTable
ALTER TABLE `Post` ADD COLUMN `seoTitle` VARCHAR(191) NULL,
    ADD COLUMN `seoDescription` VARCHAR(512) NULL,
    ADD COLUMN `canonicalUrl` VARCHAR(512) NULL,
    ADD COLUMN `ogImageUrl` VARCHAR(512) NULL;

-- AlterTable
ALTER TABLE `PostRevision` ADD COLUMN `seoTitle` VARCHAR(191) NULL,
    ADD COLUMN `seoDescription` VARCHAR(512) NULL,
    ADD COLUMN `canonicalUrl` VARCHAR(512) NULL,
    ADD COLUMN `ogImageUrl` VARCHAR(512) NULL;
