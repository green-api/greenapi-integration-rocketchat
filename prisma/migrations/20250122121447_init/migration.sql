-- CreateTable
CREATE TABLE `Workspace` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(255) NOT NULL,
    `commandToken` VARCHAR(255) NOT NULL,
    `webhookToken` VARCHAR(255) NOT NULL,
    `createdAt` BIGINT UNSIGNED NOT NULL DEFAULT (UNIX_TIMESTAMP(NOW(3)) * 1000),

    UNIQUE INDEX `Workspace_url_key`(`url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `rocketChatId` VARCHAR(255) NOT NULL,
    `rocketChatUrl` VARCHAR(255) NOT NULL,
    `rocketChatToken` VARCHAR(255) NOT NULL,
    `workspaceId` BIGINT UNSIGNED NOT NULL,
    `createdAt` BIGINT UNSIGNED NOT NULL DEFAULT (UNIX_TIMESTAMP(NOW(3)) * 1000),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Instance` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `idInstance` BIGINT UNSIGNED NOT NULL,
    `apiTokenInstance` VARCHAR(255) NOT NULL,
    `stateInstance` ENUM('notAuthorized', 'authorized', 'yellowCard', 'blocked', 'starting') NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `settings` JSON NULL,
    `createdAt` BIGINT UNSIGNED NOT NULL DEFAULT (UNIX_TIMESTAMP(NOW(3)) * 1000),

    UNIQUE INDEX `Instance_idInstance_key`(`idInstance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Instance` ADD CONSTRAINT `Instance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
