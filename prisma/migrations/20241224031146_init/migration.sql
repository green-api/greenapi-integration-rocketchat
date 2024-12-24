-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "rocketChatId" VARCHAR(255) NOT NULL,
    "rocketChatUrl" VARCHAR(255) NOT NULL,
    "rocketChatToken" VARCHAR(255) NOT NULL,
    "webhookToken" VARCHAR(255) NOT NULL,
    "commandToken" VARCHAR(255) NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" BIGSERIAL NOT NULL,
    "idInstance" BIGINT NOT NULL,
    "apiTokenInstance" VARCHAR(255) NOT NULL,
    "userId" BIGINT NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "createdAt" BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMapping" (
    "id" BIGSERIAL NOT NULL,
    "roomId" VARCHAR(255) NOT NULL,
    "userId" BIGINT NOT NULL,
    "instanceId" BIGINT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "RoomMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_idInstance_key" ON "Instance"("idInstance");

-- CreateIndex
CREATE INDEX "RoomMapping_instanceId_idx" ON "RoomMapping"("instanceId");

-- CreateIndex
CREATE INDEX "RoomMapping_createdAt_idx" ON "RoomMapping"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMapping_roomId_userId_key" ON "RoomMapping"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMapping" ADD CONSTRAINT "RoomMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMapping" ADD CONSTRAINT "RoomMapping_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
