import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { StorageProvider } from "@green-api/greenapi-integration";
import { Instance, User } from "@prisma/client";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, StorageProvider<User, Instance> {
	async onModuleInit() {
		await this.$connect();
	}

	async createInstance(instance: Instance, userId: bigint): Promise<Instance> {
		return this.instance.create({
			data: {
				idInstance: instance.idInstance,
				apiTokenInstance: instance.apiTokenInstance,
				stateInstance: instance.stateInstance,
				settings: instance.settings || {},
				userId,
			},
		});
	}

	async getInstance(idInstance: number | bigint): Promise<Instance | null> {
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

	async findInstanceByPhoneNumber(phoneNumber: string, email: string): Promise<Instance | null> {
		return this.instance.findFirst({where: {settings: {path: "$.wid", equals: phoneNumber}, user: {email}}});
	}
}
