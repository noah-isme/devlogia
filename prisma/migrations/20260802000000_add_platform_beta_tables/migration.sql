-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(32) NOT NULL DEFAULT 'free',
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Tenant_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantSettings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,
    `limits` JSON NOT NULL DEFAULT '{}',
    `planId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `TenantSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantAnalytics` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `visits` INT NOT NULL DEFAULT 0,
    `aiUsage` DECIMAL(12,4) NOT NULL DEFAULT 0.0,
    `revenue` DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    `federationShare` DOUBLE NOT NULL DEFAULT 0.0,
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `TenantAnalytics_tenantId_key`(`tenantId`),
    INDEX `TenantAnalytics_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plugin` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(512) NULL,
    `description` TEXT NULL,
    `version` VARCHAR(32) NOT NULL DEFAULT '0.1.0',
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
    `repositoryUrl` VARCHAR(512) NULL,
    `websiteUrl` VARCHAR(512) NULL,
    `metadata` JSON NOT NULL DEFAULT '{}',
    `publisherTenantId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Plugin_publisherTenantId_idx`(`publisherTenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PluginInstall` (
    `id` VARCHAR(191) NOT NULL,
    `pluginId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `installedById` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `settings` JSON NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `PluginInstall_pluginId_tenantId_key`(`pluginId`, `tenantId`),
    INDEX `PluginInstall_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Extension` (
    `id` VARCHAR(191) NOT NULL,
    `pluginId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(512) NULL,
    `surface` VARCHAR(191) NOT NULL DEFAULT 'EDITOR',
    `runtime` VARCHAR(191) NOT NULL DEFAULT 'EDGE',
    `entrypoint` VARCHAR(512) NOT NULL,
    `configSchema` JSON NOT NULL DEFAULT '{}',
    `sandboxConfig` JSON NOT NULL DEFAULT '{}',
    `metadata` JSON NOT NULL DEFAULT '{}',
    `targetTenantId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Extension_targetTenantId_idx`(`targetTenantId`),
    UNIQUE INDEX `Extension_pluginId_key_key`(`pluginId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExtensionUsage` (
    `id` VARCHAR(191) NOT NULL,
    `extensionId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `triggeredById` VARCHAR(191) NULL,
    `context` JSON NOT NULL DEFAULT '{}',
    `durationMs` INT NULL,
    `tokensConsumed` INT NOT NULL DEFAULT 0,
    `costUsd` DECIMAL(10,4) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `ExtensionUsage_tenantId_occurredAt_idx`(`tenantId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingAccount` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `connectAccountId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'INACTIVE',
    `metadata` JSON NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `BillingAccount_tenantId_key`(`tenantId`),
    UNIQUE INDEX `BillingAccount_stripeCustomerId_key`(`stripeCustomerId`),
    UNIQUE INDEX `BillingAccount_connectAccountId_key`(`connectAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'PLUGIN',
    `pluginId` VARCHAR(191) NULL,
    `extensionId` VARCHAR(191) NULL,
    `beneficiaryTenantId` VARCHAR(191) NULL,
    `priceCents` INT NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `stripePriceId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Product_pluginId_idx`(`pluginId`),
    INDEX `Product_extensionId_idx`(`extensionId`),
    INDEX `Product_beneficiaryTenantId_idx`(`beneficiaryTenantId`),
    INDEX `Product_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `billingAccountId` VARCHAR(191) NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `unitPriceCents` INT NOT NULL,
    `totalCents` INT NOT NULL,
    `taxCents` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `paymentIntentId` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(64) NULL,
    `metadata` JSON NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Order_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `Order_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevenueSplit` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `payoutId` VARCHAR(191) NULL,
    `platformPct` DECIMAL(5,4) NOT NULL,
    `authorPct` DECIMAL(5,4) NOT NULL,
    `tenantPct` DECIMAL(5,4) NOT NULL,
    `platformAmountCents` INT NOT NULL,
    `authorAmountCents` INT NOT NULL,
    `tenantAmountCents` INT NOT NULL,
    `settled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `RevenueSplit_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payout` (
    `id` VARCHAR(191) NOT NULL,
    `billingAccountId` VARCHAR(191) NOT NULL,
    `connectAccountId` VARCHAR(191) NOT NULL,
    `amountCents` INT NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `stripeTransferId` VARCHAR(191) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `metadata` JSON NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Payout_billingAccountId_status_idx`(`billingAccountId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanQuota` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(32) NOT NULL,
    `aiTokensMonthly` INT NOT NULL,
    `storageMB` INT NOT NULL,
    `seats` INT NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `PlanQuota_tenantId_effectiveFrom_idx`(`tenantId`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIExtension` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'openai',
    `model` VARCHAR(191) NOT NULL,
    `capability` VARCHAR(64) NOT NULL,
    `tokenCost` INT NOT NULL DEFAULT 0,
    `description` VARCHAR(512) NULL,
    `metadata` JSON NOT NULL DEFAULT '{}',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `AIExtension_tenantId_active_idx`(`tenantId`, `active`),
    INDEX `AIExtension_ownerId_idx`(`ownerId`),
    UNIQUE INDEX `AIExtension_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `extensionId` VARCHAR(191) NOT NULL,
    `tokensUsed` INT NOT NULL DEFAULT 0,
    `costCents` INT NOT NULL DEFAULT 0,
    `promptSummary` VARCHAR(256) NULL,
    `moderationStatus` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `AIUsageLog_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `AIUsageLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `Workspace_tenantId_slug_idx`(`tenantId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkspaceMember` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(32) NOT NULL DEFAULT 'EDITOR',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `WorkspaceMember_workspaceId_userId_key`(`workspaceId`, `userId`),
    INDEX `WorkspaceMember_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollaborationSession` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    INDEX `CollaborationSession_workspaceId_active_idx`(`workspaceId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PresenceState` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `PresenceState_sessionId_userId_key`(`sessionId`, `userId`),
    INDEX `PresenceState_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserContentAffinity` (
    `id` VARCHAR(191) NOT NULL,
    `userProfileId` VARCHAR(191) NOT NULL,
    `contentVectorId` VARCHAR(191) NOT NULL,
    `affinity` DOUBLE NOT NULL DEFAULT 0.0,
    `reason` JSON NULL,
    `lastEngagedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `UserContentAffinity_userProfileId_contentVectorId_key`(`userProfileId`, `contentVectorId`),
    INDEX `UserContentAffinity_contentVectorId_idx`(`contentVectorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
