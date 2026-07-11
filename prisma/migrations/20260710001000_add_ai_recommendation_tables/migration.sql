CREATE TABLE `HeadlineVariant` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `abKey` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HeadlineVariant_postId_idx`(`postId`),
    UNIQUE INDEX `HeadlineVariant_postId_abKey_key`(`postId`, `abKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AIUsage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NULL,
    `task` VARCHAR(64) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `tokensIn` INTEGER NOT NULL DEFAULT 0,
    `tokensOut` INTEGER NOT NULL DEFAULT 0,
    `usd` DECIMAL(10, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIUsage_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AIUsage_postId_createdAt_idx`(`postId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AIAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `postId` VARCHAR(191) NULL,
    `task` VARCHAR(64) NOT NULL,
    `promptHash` CHAR(64) NOT NULL,
    `promptExcerpt` VARCHAR(200) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(64) NOT NULL,
    `tokens` INTEGER NOT NULL DEFAULT 0,
    `moderated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIAuditLog_createdAt_idx`(`createdAt`),
    INDEX `AIAuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AIAuditLog_postId_createdAt_idx`(`postId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Embedding` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `dimension` INTEGER NOT NULL,
    `vector` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Embedding_postId_key`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Recommendation` (
    `id` VARCHAR(191) NOT NULL,
    `sourcePostId` VARCHAR(191) NOT NULL,
    `targetPostId` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Recommendation_sourcePostId_idx`(`sourcePostId`),
    INDEX `Recommendation_targetPostId_idx`(`targetPostId`),
    UNIQUE INDEX `Recommendation_sourcePostId_targetPostId_key`(`sourcePostId`, `targetPostId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RecommendationSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `embeddingId` VARCHAR(191) NOT NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RecommendationSnapshot_embeddingId_idx`(`embeddingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TopicCluster` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `keywords` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PostTopic` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `topicId` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostTopic_topicId_idx`(`topicId`),
    UNIQUE INDEX `PostTopic_postId_topicId_key`(`postId`, `topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HeadlineVariant` ADD CONSTRAINT `HeadlineVariant_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AIUsage` ADD CONSTRAINT `AIUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AIUsage` ADD CONSTRAINT `AIUsage_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AIAuditLog` ADD CONSTRAINT `AIAuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AIAuditLog` ADD CONSTRAINT `AIAuditLog_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Embedding` ADD CONSTRAINT `Embedding_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Recommendation` ADD CONSTRAINT `Recommendation_sourcePostId_fkey` FOREIGN KEY (`sourcePostId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Recommendation` ADD CONSTRAINT `Recommendation_targetPostId_fkey` FOREIGN KEY (`targetPostId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RecommendationSnapshot` ADD CONSTRAINT `RecommendationSnapshot_embeddingId_fkey` FOREIGN KEY (`embeddingId`) REFERENCES `Embedding`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PostTopic` ADD CONSTRAINT `PostTopic_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PostTopic` ADD CONSTRAINT `PostTopic_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `TopicCluster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
