-- Phase 9 personalization schema changes
CREATE TABLE `UserProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `topics` JSON NOT NULL,
    `preferences` JSON NOT NULL,
    `featureVector` JSON NULL,
    `avgReadTimeSeconds` INTEGER NOT NULL DEFAULT 0,
    `sessionCount` INTEGER NOT NULL DEFAULT 0,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `tonePreference` VARCHAR(64) NULL,
    `segment` VARCHAR(64) NULL,
    `personalizationOptOut` BOOLEAN NOT NULL DEFAULT FALSE,
    `analyticsOptOut` BOOLEAN NOT NULL DEFAULT FALSE,
    `lastActiveAt` DATETIME(3) NULL,
    `lastInsightRefresh` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `UserProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContentVector` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `embedding` JSON NOT NULL,
    `topicTags` JSON NOT NULL,
    `engagementScore` DOUBLE NOT NULL DEFAULT 0,
    `freshnessScore` DOUBLE NOT NULL DEFAULT 0,
    `highlights` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ContentVector_postId_key`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_content_affinity` (
    `id` VARCHAR(191) NOT NULL,
    `userProfileId` VARCHAR(191) NOT NULL,
    `contentVectorId` VARCHAR(191) NOT NULL,
    `affinity` DOUBLE NOT NULL DEFAULT 0,
    `reason` JSON NULL,
    `lastEngagedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `user_content_affinity_userProfileId_contentVectorId_key`(`userProfileId`, `contentVectorId`),
    INDEX `user_content_affinity_contentVectorId_idx`(`contentVectorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ContentVector` ADD CONSTRAINT `ContentVector_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_content_affinity` ADD CONSTRAINT `user_content_affinity_userProfileId_fkey` FOREIGN KEY (`userProfileId`) REFERENCES `UserProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_content_affinity` ADD CONSTRAINT `user_content_affinity_contentVectorId_fkey` FOREIGN KEY (`contentVectorId`) REFERENCES `ContentVector`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
