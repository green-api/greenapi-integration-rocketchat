import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	Logger,
	Post,
	UseGuards,
} from "@nestjs/common";
import { CoreService } from "../core/core.service";
import { DatabaseService } from "../database/database.service";
import { IncomingGreenApiWebhook } from "@green-api/greenapi-integration";
import { RocketChatWebhook, RocketChatCommand } from "../types/types";
import { RocketChatCommandGuard } from "./guards/rocket-chat-command.guard";
import { RocketChatWebhookGuard } from "./guards/rocket-chat-webhook.guard";
import { GreenApiGuard } from "./guards/green-api.guard";

@Controller("webhook")
export class GatewayController {
	private readonly logger = new Logger(GatewayController.name);

	constructor(
		private readonly rocketChatService: CoreService,
		private readonly db: DatabaseService,
	) {}

	@Post("green-api")
	@UseGuards(GreenApiGuard)
	@HttpCode(200)
	async handleGreenApiWebhook(
		@Body() webhook: IncomingGreenApiWebhook,
	) {
		try {
			this.rocketChatService.handleGreenApiWebhook(webhook, ["incomingMessageReceived"]);
			return {status: "ok"};
		} catch (error) {
			this.logger.error(`Error handling GREEN-API webhook: ${error.message}`);
			throw error;
		}
	}

	@Post("rocket")
	@UseGuards(RocketChatWebhookGuard)
	@HttpCode(200)
	async handleRocketWebhook(
		@Body() message: RocketChatWebhook,
	) {
		try {
			const roomId = message.messages[0].rid;
			const agentEmail = message.agent.email;
			const agentId = message.agent._id;

			const user = await this.db.user.findFirst({
				where: {rocketChatId: agentId},
				include: {Instance: true},
			});
			if (!user) {
				throw new BadRequestException("User not found");
			}

			let instance = await this.db.findInstanceByRoomId(roomId, agentEmail);
			if (!instance) {
				throw new BadRequestException("Instance by room mapping not found");
			}

			await this.rocketChatService.handlePlatformWebhook(message, instance.idInstance);
			return {status: "ok"};
		} catch (error) {
			this.logger.error(`Error handling Rocket.Chat webhook: ${error.message}`);
			throw error;
		}
	}

	@Post("rocket/:command")
	@UseGuards(RocketChatCommandGuard)
	@HttpCode(200)
	async handleRocketCommand(
		@Body() body: RocketChatCommand,
	) {
		try {
			return this.rocketChatService.handleCommand(body);
		} catch (error) {
			this.logger.error(`Error handling Rocket.Chat command: ${error.message}`);
			throw error;
		}
	}
}
