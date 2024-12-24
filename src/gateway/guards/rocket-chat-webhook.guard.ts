import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RocketChatWebhook } from "../../types/types";

@Injectable()
export class RocketChatWebhookGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = request.headers["x-rocketchat-livechat-token"];
		if (!token) {
			throw new UnauthorizedException("X-Rocketchat-Livechat-Token header is missing");
		}

		const message = request.body as RocketChatWebhook;
		const agentEmail = message?.agent?.email;

		if (!agentEmail) {
			throw new UnauthorizedException("Invalid webhook format");
		}
		const user = await this.db.findUser(agentEmail);

		if (!user) {
			throw new UnauthorizedException("No user with such credentials");
		} else if (user.webhookToken !== token) {
			throw new UnauthorizedException("Invalid token");
		}

		request.user = user;
		return true;
	}
}
