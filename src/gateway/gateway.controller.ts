import {
	Body,
	Controller,
	HttpCode,
	Logger,
	Post, Req,
	UseGuards,
} from "@nestjs/common";
import { CoreService } from "../core/core.service";
import { GreenApiWebhook } from "@green-api/greenapi-integration";
import { RocketChatWebhook, RocketChatCommand } from "../types/types";
import { RocketChatCommandGuard } from "./guards/rocket-chat-command.guard";
import { RocketChatWebhookGuard } from "./guards/rocket-chat-webhook.guard";
import { GreenApiGuard } from "./guards/green-api.guard";
import { Instance } from "@prisma/client";

interface ExtRequest extends Request {
	instance?: Instance;
}

@Controller("webhook")
export class GatewayController {
	private readonly logger = new Logger(GatewayController.name);

	constructor(private readonly rocketChatService: CoreService) {}

	@Post("green-api")
	@UseGuards(GreenApiGuard)
	@HttpCode(200)
	async handleGreenApiWebhook(
		@Body() webhook: GreenApiWebhook,
	) {
		if (webhook.typeWebhook === "incomingMessageReceived") {
			this.logger.log(`Message from visitor ${webhook.senderData.chatId} to instance with id ${webhook.instanceData.idInstance}`);
		} else if (webhook.typeWebhook === "stateInstanceChanged") {
			this.logger.log(`Status of ${webhook.instanceData.idInstance} instance was changed to ${webhook.stateInstance}`);
		}
		this.rocketChatService.handleGreenApiWebhook(webhook, ["incomingMessageReceived", "stateInstanceChanged"]).catch(e => {
			this.logger.error(`Error handling GREEN-API webhook: ${e.message}`, {e, webhook});
		});
		return {status: "ok"};
	}

	@Post("rocket")
	@UseGuards(RocketChatWebhookGuard)
	@HttpCode(200)
	async handleRocketWebhook(
		@Body() message: RocketChatWebhook,
		@Req() request: ExtRequest,
	) {
		const instance = request.instance;
		this.logger.log(`Message from agent ${message.agent.email} to ${message.visitor.username} on instance ${instance.idInstance}`);
		if (instance.stateInstance === "notAuthorized") {
			this.logger.warn(`Skipping webhook processing for instance ${instance.idInstance} due to unauthorized state`);
			return {status: "ok"};
		}
		this.rocketChatService.handlePlatformWebhook(message, instance.idInstance).catch(e => {
			this.logger.error(`Error handling Rocket.chat webhook: ${e.message}`, {e, message});
		});
		return {status: "ok"};
	}

	@Post("rocket/:command")
	@UseGuards(RocketChatCommandGuard)
	@HttpCode(200)
	async handleRocketCommand(
		@Body() body: RocketChatCommand,
	) {
		try {
			this.logger.log(`User with email ${body.email} from ${body.rocketChatUrl} invoked command ${body.type}`);
			return this.rocketChatService.handleCommand(body);
		} catch (error) {
			this.logger.error(`Error handling Rocket.Chat command: ${error.message}`, {body});
		}
	}
}
