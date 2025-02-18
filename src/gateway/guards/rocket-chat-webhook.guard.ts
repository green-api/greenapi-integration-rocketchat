import {
	Injectable,
	CanActivate,
	ExecutionContext,
	HttpStatus,
	HttpException,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RocketChatWebhook } from "../../types/types";
import { GreenApiLogger } from "@green-api/greenapi-integration";

@Injectable()
export class RocketChatWebhookGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	private readonly logger = GreenApiLogger.getInstance(RocketChatWebhookGuard.name);

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = request.headers["x-rocketchat-livechat-token"];
		if (!token) {
			this.logger.warn("X-Rocketchat-Livechat-Token header is missing", request.body);
			throw new HttpException({message: "X-Rocketchat-Livechat-Token header is missing"}, HttpStatus.OK);
		}

		const message = request.body as RocketChatWebhook;

		if (!message.messages?.[0]?.agentId) {
			this.logger.warn("Not an agent message", message);
			throw new HttpException({message: "Not an agent message"}, HttpStatus.OK);
		}

		const agentEmail = message?.agent?.email;
		if (!agentEmail) {
			this.logger.warn("Invalid webhook format", message);
			throw new HttpException({message: "Invalid webhook format"}, HttpStatus.OK);
		}

		const user = await this.db.findUser(agentEmail);
		if (!user) {
			this.logger.warn("No user with such credentials", message);
			throw new HttpException({message: "No user with such credentials"}, HttpStatus.OK);
		}

		const workspace = await this.db.findWorkspaceById(user.workspaceId);
		if (!workspace || workspace.webhookToken !== token) {
			this.logger.warn("Invalid webhook token", message);
			throw new HttpException({message: "Invalid webhook token"}, HttpStatus.OK);
		}

		const instance = await this.db.findInstanceByPhoneNumber(
			`${message.visitor.token.split(":")[1]}@c.us`, workspace.id,
		);
		if (!instance) {
			this.logger.warn("Instance by phone number is not found", message);
			throw new HttpException({message: "Instance by phone number is not found"}, HttpStatus.OK);
		}

		request.instance = instance;
		return true;
	}
}
