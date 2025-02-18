import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import {
	BaseAdapter,
	generateRandomToken,
	WaSettings,
	StateInstanceWebhook,
	GreenApiClient,
} from "@green-api/greenapi-integration";
import {
	RocketChatCommand,
	RocketChatWebhook,
	TransformedRocketChatWebhook,
} from "../types/types";
import { RocketChatTransformer } from "./transformer";
import axios, { AxiosInstance } from "axios";
import { DatabaseService } from "../database/database.service";
import { Instance } from "@prisma/client";

@Injectable()
export class CoreService extends BaseAdapter<RocketChatWebhook, TransformedRocketChatWebhook> {
	constructor(
		protected readonly storage: DatabaseService,
		protected readonly transformer: RocketChatTransformer,
	) {
		super(transformer, storage);
		this.gaLogger.info("Starting the service");
	}

	async createPlatformClient(instance: Instance): Promise<AxiosInstance> {
		const user = await this.storage.user.findUnique({
			where: {id: instance.userId},
			select: {workspace: {select: {url: true}}, rocketChatId: true, rocketChatToken: true},
		});
		if (!user) {
			throw new Error("User not found");
		}
		const baseUrl = user.workspace.url.endsWith("/")
			? user.workspace.url.slice(0, -1)
			: user.workspace.url;

		return axios.create({
			baseURL: `${baseUrl}/api/v1`,
			headers: {
				"X-Auth-Token": user.rocketChatToken,
				"X-User-Id": user.rocketChatId,
			},
		});
	}

	async sendToPlatform(message: TransformedRocketChatWebhook, instance: Instance): Promise<void> {
		this.gaLogger.info("Sending a message to Rocket.chat from GREEN-API", {
			transformedWebhook: message,
			idInstance: instance.idInstance,
		});
		try {
			const client = await this.createPlatformClient(instance);
			const user = await this.storage.user.findUnique({
				where: {id: instance.userId},
				select: {rocketChatId: true},
			});

			if (!user) {
				throw new Error("User not found");
			}
			const visitor = await this.createVisitor(message.token, message.name, client, instance.settings.wid.split("@")[0]);
			const room = await this.createRoom(visitor.token, client, user.rocketChatId);
			if (message.file) {
				const fileResponse = await axios.get(message.file.url, {responseType: "arraybuffer"});
				const blob = new Blob([fileResponse.data], {type: message.file.mimeType});

				const formData = new FormData();
				formData.append("file", blob, `${message.id}:greenapi:${message.file.fileName}`);
				formData.append("msg", message.file.caption || "");

				await client.post(`/livechat/upload/${room.rid}`, formData, {
					headers: {
						"Content-Type": "multipart/form-data",
						"X-Visitor-Token": visitor.token,
					},
				});
			} else {
				await client.post("/livechat/message", {
					token: visitor.token,
					rid: room.rid,
					msg: message.msg,
					_id: `greenapi:${message.id}`,
				});
			}
		} catch (error) {
			this.gaLogger.logErrorResponse(error, "sendToPlatform");
			const errorMessage = error.response?.data?.error || error.message || "Failed to send message to RocketChat";
			throw new InternalServerErrorException(errorMessage);
		}
	}

	public async handleStateInstanceWebhook(webhook: StateInstanceWebhook): Promise<void> {
		const instance = await this.storage.getInstance(webhook.instanceData.idInstance);
		if (!instance) return;

		await this.storage.instance.update({
			where: {id: instance.id},
			data: {
				settings: {
					...instance.settings,
					wid: webhook.instanceData.wid,
				},
				stateInstance: webhook.stateInstance,
			},
		});
	}

	private async createVisitor(token: string, name: string, client: AxiosInstance, wid: string) {
		const cleanToken = token.replace(/@[cg]\.us$/, "");
		const response = await client.post("/livechat/visitor", {
			visitor: {
				token: `greenapi:${wid}:${cleanToken}`,
				name,
				phone: cleanToken,
				username: `greenapi:${token}`,
			},
		});
		this.gaLogger.info(`Created visitor greenapi:${token}`, {visitor: response.data.visitor});
		return response.data.visitor;
	}

	private async createRoom(visitorToken: string, client: AxiosInstance, rocketChatId: string) {
		const response = await client.get("/livechat/room", {
			params: {token: visitorToken, agentId: rocketChatId},
		});
		this.gaLogger.info("Created or fetched a room", {roomData: response.data});
		return {rid: response.data.room._id};
	}

	async handleCommand(body: RocketChatCommand) {
		try {
			switch (body.type) {
				case "register-workspace": {
					if (!body.rocketChatUrl || !body.rocketChatId || !body.rocketChatToken) {
						throw new BadRequestException("All fields are required");
					}
					const existingWorkspace = await this.storage.workspace.findUnique(
						{where: {url: body.rocketChatUrl}},
					);
					if (existingWorkspace) {
						throw new BadRequestException("This workspace already exists");
					}
					this.gaLogger.info("Registering a Rocket.chat workspace", {
						adminEmail: body.email,
						adminRocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						roles: body.roles,
					});
					const commandToken = generateRandomToken(16);
					const webhookToken = generateRandomToken(20);
					await this.storage.createWorkspace({url: body.rocketChatUrl, commandToken, webhookToken});
					return {commandToken, webhookToken};
				}
				case "register-agent": {
					if (Object.values(body).some(value => !value)) {
						throw new BadRequestException("All fields are required");
					}
					const existingUser = await this.storage.user.findUnique(
						{where: {email: body.email}},
					);
					if (existingUser) {
						throw new BadRequestException("This agent already exists");
					}

					this.gaLogger.info("Registering a Rocket.chat agent", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
					});
					await this.createUser(body.email, {
						email: body.email,
						rocketChatUrl: body.rocketChatUrl,
						rocketChatId: body.rocketChatId,
						rocketChatToken: body.rocketChatToken,
					});
					return {
						message: "success",
					};
				}
				case "update-token": {
					if (Object.values(body).some(value => !value)) {
						throw new BadRequestException("rocket.chat ID and rocket.chat token are required");
					}
					this.gaLogger.info("Registering a Rocket.chat agent", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						roles: body.roles,
					});
					await this.updateUser(body.email, {
						rocketChatId: body.rocketChatId,
						rocketChatToken: body.rocketChatToken,
					});
					return {message: "Token updated successfully"};
				}
				case "create-instance": {
					if (Object.values(body).some(value => !value)) {
						throw new BadRequestException("Instance ID and token are required");
					}
					this.gaLogger.info("Creating a GREEN-API instance for a Rocket.chat agent", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						idInstance: body.idInstance,
						roles: body.roles,
					});
					const existingInstance = await this.storage.getInstance(BigInt(body.idInstance));
					if (existingInstance) {
						throw new BadRequestException("Instance already exists");
					}
					const user = await this.storage.findUser(body.email);
					if (!user) {
						throw new BadRequestException("User not found");
					}
					const client = this.createGreenApiClient({
						idInstance: body.idInstance,
						apiTokenInstance: body.apiTokenInstance,
					});
					let waSettings: WaSettings;
					try {
						waSettings = await client.getWaSettings();
					} catch (error: any) {
						throw new BadRequestException(`Failed to get settings for instance ${body.idInstance}: ${error.message}`, "INTEGRATION_ERROR");
					}
					return this.createInstance({
						idInstance: BigInt(body.idInstance),
						apiTokenInstance: body.apiTokenInstance,
						settings: {
							webhookUrl: process.env.APP_URL + "/api/webhook/green-api",
							webhookUrlToken: generateRandomToken(),
							incomingWebhook: "yes",
							pollMessageWebhook: "yes",
							stateWebhook: "yes",
							wid: waSettings.phone ? `${waSettings.phone}@c.us` : undefined,
						},
						stateInstance: waSettings.stateInstance,
						userId: user.id,
						workspaceId: user.workspaceId,
					}).then(r => r.idInstance);
				}
				case "remove-instance": {
					if (!body.idInstance) {
						throw new BadRequestException("Instance ID is required");
					}
					this.gaLogger.info("Removing a GREEN-API instance from a Rocket.chat agent", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						idInstance: body.idInstance,
						roles: body.roles,
					});
					const workspace = await this.storage.findWorkspace(body.rocketChatUrl);
					if (!workspace) {
						throw new BadRequestException("Workspace not found");
					}
					const instance = await this.storage.getInstance(BigInt(body.idInstance));
					if (!instance || instance.workspaceId !== workspace.id) {
						throw new BadRequestException("Instance not found");
					}
					return this.removeInstance(BigInt(body.idInstance)).then(r => r.idInstance);
				}
				case "sync-app-url": {
					this.gaLogger.info("Synchronizing app url", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						appUrl: body.appUrl,
						roles: body.roles,
					});
					const workspaceId = await this.storage.findWorkspace(body.rocketChatUrl).then(r => r.id);
					const instances = await this.storage.getInstances(workspaceId, true);

					const results = await Promise.allSettled(instances.map(async instance => {
						try {
							const greenApiClient = new GreenApiClient({
								idInstance: instance.idInstance,
								apiTokenInstance: instance.apiTokenInstance,
							});
							await greenApiClient.setSettings({webhookUrl: body.appUrl.replace("rocket", "green-api")});
							return {success: true, instance};
						} catch (error) {
							return {
								success: false,
								instance,
								error: error instanceof Error ? error.message : String(error),
							};
						}
					}));

					const failedInstances = results
						.filter((result): result is PromiseRejectedResult | {
							status: "fulfilled",
							value: { success: false, instance: any, error: string }
						} =>
							result.status === "rejected" || (result.status === "fulfilled" && !result.value.success))
						.map(result => {
							if (result.status === "rejected") {
								return {
									idInstance: "Unknown",
									error: result.reason instanceof Error ? result.reason.message : String(result.reason),
								};
							}
							return {
								idInstance: result.value.instance.idInstance,
								error: result.value.error,
							};
						});

					const successCount = results.filter(r => r.status === "fulfilled" && r.value.success).length;

					let message = `Synchronized ${successCount} out of ${instances.length} instances.`;
					if (failedInstances.length > 0) {
						message += "\n\nFailed instances:\n" + failedInstances
							.map(instance => `Instance ID: ${instance.idInstance}\nError: ${instance.error}`)
							.join("\n\n");
					}

					return {message};
				}
				case "list-instances": {
					this.gaLogger.info("Listing instances", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						roles: body.roles,
					});
					const workspace = await this.storage.findWorkspace(body.rocketChatUrl);
					if (!workspace) {
						throw new BadRequestException("Workspace not found");
					}

					const instances = await this.storage.getInstances(workspace.id);

					if (instances.length === 0) {
						throw new NotFoundException("No instances found in this workspace.");
					}

					const formattedInstances = instances.map(instance =>
						`Instance ID: ${instance.idInstance}
       				 Status: ${instance.stateInstance}
        			 User: ${instance.user.email}
        			 Created: ${new Date(Number(instance.createdAt)).toLocaleString()}`,
					).join("\n\n");

					return {message: `Found ${instances.length} instances in workspace:\n\n${formattedInstances}`};
				}
				case "list-users": {
					this.gaLogger.info("Listing users", {
						email: body.email,
						rocketChatId: body.rocketChatId,
						url: body.rocketChatUrl,
						roles: body.roles,
					});
					const workspace = await this.storage.findWorkspace(body.rocketChatUrl);
					if (!workspace) {
						throw new BadRequestException("Workspace not found");
					}

					const users = await this.storage.user.findMany({
						where: {workspaceId: workspace.id},
						select: {
							email: true,
							rocketChatId: true,
							createdAt: true,
							_count: {
								select: {Instance: true},
							},
						},
					});

					if (users.length === 0) {
						throw new NotFoundException("No users found in this workspace.");
					}

					const formattedUsers = users.map(user =>
						`Email: ${user.email}
         			 RocketChat ID: ${user.rocketChatId}
         			 Created: ${new Date(Number(user.createdAt)).toLocaleString()}
         			 Active Instances: ${user._count.Instance}`,
					).join("\n\n");

					return {message: `Found ${users.length} users in workspace:\n\n${formattedUsers}`};
				}
				default: {
					throw new BadRequestException("Unknown command");
				}
			}
		} catch (error) {
			this.gaLogger.logErrorResponse(error, `handleCommand:${body.type}`);
			throw error;
		}
	}
}
