import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import {
	BaseAdapter,
	generateRandomToken,
	WaSettings,
	StateInstanceWebhook,
	GreenApiClient,
} from "@green-api/greenapi-integration";
import {
	RegisterWorkspaceCommand,
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
	private readonly logger = new Logger(CoreService.name);

	constructor(
		protected readonly storage: DatabaseService,
		protected readonly transformer: RocketChatTransformer,
	) {
		super(transformer, storage);
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
				formData.append("file", blob, message.file.fileName);
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
			if (error.response) {
				this.logger.error("RocketChat API Error Response:", {
					status: error.response.status,
					data: error.response.data,
				});
			} else if (error.request) {
				this.logger.error("RocketChat API No Response:", error.request);
			} else {
				this.logger.error("RocketChat API Error:", error.message);
			}

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
		return response.data.visitor;
	}

	private async createRoom(visitorToken: string, client: AxiosInstance, rocketChatId: string) {
		const response = await client.get("/livechat/room", {
			params: {token: visitorToken, agentId: rocketChatId},
		});
		return {rid: response.data.room._id};
	}

	private async setupRocketChatWebhook(data: RegisterWorkspaceCommand, webhookToken: string) {
		try {
			await axios.post(`${data.rocketChatUrl}/api/v1/omnichannel/integrations`, {
				LivechatWebhookUrl: process.env.APP_URL + "/api/webhook/rocket",
				LivechatSecretToken: webhookToken,
				LivechatWebhookOnAgentMessage: true,
				LivechatHttpTimeout: 10000,
			}, {
				headers: {
					"X-Auth-Token": data.rocketChatToken,
					"X-User-Id": data.rocketChatId,
				},
			});
		} catch (error) {
			this.logger.error(`Error when trying to set a rocket.chat webhook: ${error.message}`, {error: error.response.data});
			throw new BadRequestException("Incorrect data provided");
		}
	}

	async handleCommand(body: RocketChatCommand) {
		switch (body.type) {
			case "register-workspace": {
				if (!body.rocketChatUrl || !body.rocketChatId || !body.rocketChatToken) {
					throw new BadRequestException("All fields are required");
				}
				const commandToken = generateRandomToken(16);
				const webhookToken = generateRandomToken(20);
				await this.setupRocketChatWebhook(body, webhookToken);
				await this.storage.createWorkspace({url: body.rocketChatUrl, commandToken, webhookToken});
				return {commandToken};
			}
			case "register-agent": {
				if (Object.values(body).some(value => !value)) {
					throw new BadRequestException("All fields are required");
				}
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
				return this.updateUser(body.email, {
					rocketChatId: body.rocketChatId,
					rocketChatToken: body.rocketChatToken,
				});
			}
			case "create-instance": {
				if (Object.values(body).some(value => !value)) {
					throw new BadRequestException("Instance ID and token are required");
				}
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
				try {
					const workspaceId = await this.storage.findWorkspace(body.rocketChatUrl).then(r => r.id);
					const instances = await this.storage.getInstances(workspaceId);

					await Promise.all(instances.map(instance => {
						const greenApiClient = new GreenApiClient({
							idInstance: instance.idInstance,
							apiTokenInstance: instance.apiTokenInstance,
						});
						return greenApiClient.setSettings({webhookUrl: body.appUrl.replace("rocket", "green-api")});
					}));
				} catch (error) {
					throw new Error(`Failed to update instance settings: ${error.message}`);
				}
				break;
			}
			case "list-instances": {
				const workspace = await this.storage.findWorkspace(body.rocketChatUrl);
				if (!workspace) {
					throw new BadRequestException("Workspace not found");
				}

				const instances = await this.storage.getInstances(workspace.id);

				if (instances.length === 0) {
					return "No instances found in this workspace.";
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
					return "No users found in this workspace.";
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
	}
}
