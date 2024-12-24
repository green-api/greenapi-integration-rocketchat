import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { BaseAdapter, generateRandomToken } from "@green-api/greenapi-integration";
import {
	CreateInstanceCommand,
	RegisterUserData,
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
		const user = await this.storage.findUserById(BigInt(instance.userId));
		if (!user) {
			throw new Error("User not found");
		}

		return axios.create({
			baseURL: `${user.rocketChatUrl}/api/v1`,
			headers: {
				"X-Auth-Token": user.rocketChatToken,
				"X-User-Id": user.rocketChatId,
			},
		});
	}

	async sendToPlatform(message: TransformedRocketChatWebhook, instance: Instance): Promise<void> {
		try {
			const client = await this.createPlatformClient(instance);
			const visitor = await this.createVisitor(message.token, message.name, client);
			const room = await this.createRoom(visitor.token, client);
			try {
				await this.storage.createRoomMapping(room.rid, instance.userId, instance.id);
			} catch (e) {
				this.logger.debug(`Room mapping for room ${room.rid} and instance ${instance.idInstance} already exists, skipping this step`);
			}
			if (message.file) {
				await this.handleFileMessage(message, room.rid, visitor.token, client);
			} else {
				await this.handleTextMessage(message, room.rid, visitor.token, client);
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

	private async handleFileMessage(message: TransformedRocketChatWebhook, rid: string, visitorToken: string, client: AxiosInstance): Promise<void> {
		const fileResponse = await axios.get(message.file.url, {responseType: "arraybuffer"});
		const blob = new Blob([fileResponse.data], {type: message.file.mimeType});

		const formData = new FormData();
		formData.append("file", blob, message.file.fileName);
		formData.append("msg", message.file.caption || "");

		await client.post(`/livechat/upload/${rid}`, formData, {
			headers: {
				"Content-Type": "multipart/form-data",
				"X-Visitor-Token": visitorToken,
			},
		});
	}

	private async handleTextMessage(message: TransformedRocketChatWebhook, rid: string, visitorToken: string, client: AxiosInstance): Promise<void> {
		await client.post("/livechat/message", {
			token: visitorToken,
			rid,
			msg: message.msg,
		});
	}

	private async createVisitor(token: string, name: string, client: AxiosInstance) {
		const response = await client.post("/livechat/visitor", {
			visitor: {
				token,
				name,
				phone: token,
			},
		});
		return response.data.visitor;
	}

	private async createRoom(visitorToken: string, client: AxiosInstance) {
		const response = await client.get("/livechat/room", {
			params: {token: visitorToken},
		});
		return {rid: response.data.room._id};
	}

	private async setupRocketChatWebhook(data: RegisterUserData, webhookToken: string) {
		try {
			await axios.post(`${data.rocketChatUrl}/api/v1/omnichannel/integrations`, {
				LivechatWebhookUrl: process.env.APP_URL + "/api/webhook/rocket",
				LivechatSecretToken: webhookToken,
				LivechatWebhookOnAgentMessage: true,
				LivechatWebhookOnStart: true,
				LivechatHttpTimeout: 10000,
			}, {
				headers: {
					"X-Auth-Token": data.rocketChatToken,
					"X-User-Id": data.rocketChatId,
				},
			});
		} catch (error) {
			this.logger.error(`Error when trying to set a rocket.chat webhook: ${error.message}`);
			throw new BadRequestException("Incorrect data provided");
		}
	}

	async handleCommand(body: RocketChatCommand) {
		switch (body.type) {
			case "register":
				if (Object.values(body).some(value => !value)) {
					throw new BadRequestException("All fields are required");
				}
				const webhookToken = generateRandomToken();
				await this.setupRocketChatWebhook(body, webhookToken);
				const user = await this.createUser(body.email, {
					email: body.email,
					rocketChatUrl: body.rocketChatUrl,
					rocketChatId: body.rocketChatId,
					rocketChatToken: body.rocketChatToken,
					commandToken: generateRandomToken(16),
					webhookToken,
				});
				return {
					message: `Registration successful. Your command token for invoking other commands: ${user.commandToken}. ` +
						`Always include it in the end of the command.`,
				};
			case "update-token":
				if (Object.values(body).some(value => !value)) {
					throw new BadRequestException("rocket.chat ID and rocket.chat token are required");
				}
				return this.updateUser(body.email, {
					rocketChatId: body.rocketChatId,
					rocketChatToken: body.rocketChatToken,
				});
			case "create-instance":
				body = body as CreateInstanceCommand;
				if (Object.values(body).some(value => !value)) {
					throw new BadRequestException("Instance ID and token are required");
				}
				return this.createInstance({
					idInstance: BigInt(body.idInstance), apiTokenInstance: body.apiTokenInstance,
				}, {
					webhookUrl: process.env.APP_URL + "/api/webhook/green-api",
					webhookUrlToken: generateRandomToken(),
					incomingWebhook: "yes",
				}, body.email).then(r => r.idInstance);
			case "remove-instance":
				if (!body.idInstance) {
					throw new BadRequestException("Instance ID is required");
				}
				return this.removeInstance(BigInt(body.idInstance)).then(r => r.idInstance);
			default:
				throw new BadRequestException("Unknown command");
		}
	}
}
