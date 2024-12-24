import { BadRequestException, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { StorageProvider, Settings } from "@green-api/greenapi-integration";
import { Instance, User } from "@prisma/client";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, StorageProvider<User, Instance> {
	async onModuleInit() {
		await this.$connect();
	}

	async createInstance(instance: Instance, userId: bigint, settings?: Settings): Promise<Instance> {
		return this.instance.create({
			data: {
				idInstance: instance.idInstance,
				apiTokenInstance: instance.apiTokenInstance,
				settings: settings || {},
				userId,
			},
		});
	}

	async getInstance(idInstance: number): Promise<Instance | null> {
		return this.instance.findUnique({
			where: {idInstance},
			include: {user: {select: {id: true}}},
		});
	}

	async removeInstance(idInstance: number | bigint): Promise<Instance> {
		return this.instance.delete({
			where: {idInstance},
		});
	}

	async findUserById(userId: bigint) {
		return this.user.findUnique({
			where: {
				id: userId,
			},
		});
	}

	async findUser(email: string) {
		return this.user.findUnique({
			where: {
				email,
			},
		});
	}

	async createUser(data: {
		email: string,
		rocketChatId: string,
		rocketChatUrl: string,
		rocketChatToken: string,
		webhookToken: string,
		commandToken: string
	}) {
		return this.user.create({data});
	}

	async updateUser(email: string, data: { rocketChatToken: string, rocketChatId: string }) {
		return this.user.update({
			where: {
				email,
			},
			data: data,
		});
	}

	async findInstanceByRoomId(roomId: string, email: string): Promise<Instance | null> {
		const user = await this.user.findUnique({
			where: {
				email,
			},
			select: {id: true},
		});
		if (!user) {
			throw new BadRequestException("User not found");
		}
		const roomMapping = await this.roomMapping.findUnique({
			where: {
				roomId_userId: {
					roomId, userId: user.id,
				},
			},
			include: {
				instance: true,
			},
		});

		return roomMapping?.instance || null;
	}

	async createRoomMapping(roomId: string, userId: bigint, instanceId: bigint): Promise<void> {
		await this.roomMapping.create({
			data: {
				roomId,
				userId,
				instanceId,
				createdAt: Date.now(),
			},
		});
	}
}
