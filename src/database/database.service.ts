import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Workspace } from "@prisma/client";
import { StorageProvider } from "@green-api/greenapi-integration";
import { Instance, User } from "@prisma/client";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, StorageProvider<User, Instance> {
	async onModuleInit() {
		await this.$connect();
	}

	async createInstance(instance: Instance, userId: bigint): Promise<Instance> {
		const user = await this.user.findUnique({
			where: {id: userId},
			select: {workspaceId: true},
		});
		return this.instance.create({
			data: {
				idInstance: instance.idInstance,
				apiTokenInstance: instance.apiTokenInstance,
				stateInstance: instance.stateInstance,
				settings: instance.settings || {},
				userId,
				workspaceId: user.workspaceId,
			},
		});
	}

	async getInstances(userId: bigint): Promise<Instance[]> {
		return this.instance.findMany({where: {userId}});
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

	async findUser(email: string) {
		return this.user.findUnique({
			where: {
				email,
			},
		});
	}

	async findWorkspace(url: string): Promise<Workspace> {
		return this.workspace.findUnique({where: {url}});
	}

	async findWorkspaceById(workspaceId: bigint) {
		return this.workspace.findUnique({where: {id: workspaceId}});
	}

	async createWorkspace(data: { url: string, commandToken: string, webhookToken: string }): Promise<Workspace> {
		return this.workspace.create({data});
	}

	async createUser(data: {
		email: string,
		rocketChatId: string,
		rocketChatUrl: string,
		rocketChatToken: string,
	}) {
		const workspace = await this.findWorkspace(data.rocketChatUrl);
		return this.user.create({
			data: {
				rocketChatToken: data.rocketChatToken,
				rocketChatId: data.rocketChatId,
				workspaceId: workspace.id,
				email: data.email,
			},
		});
	}

	async updateUser(email: string, data: { rocketChatToken: string, rocketChatId: string }) {
		return this.user.update({
			where: {
				email,
			},
			data: data,
		});
	}

	async findInstanceByPhoneNumber(phoneNumber: string, workspaceId: bigint): Promise<Instance | null> {
		const workspace = await this.workspace.findUnique({
			where: {id: workspaceId},
		});

		if (!workspace) return null;
		return this.instance.findFirst({
			where: {
				settings: {path: "$.wid", equals: phoneNumber},
				workspaceId: workspace.id,
			},
		});
	}
}
