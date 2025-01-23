import {
	Injectable,
	CanActivate,
	ExecutionContext,
	HttpStatus,
	HttpException,
} from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RocketChatWebhook } from "../../types/types";

@Injectable()
export class RocketChatWebhookGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const token = request.headers["x-rocketchat-livechat-token"];
		if (!token) {
			throw new HttpException({message: "X-Rocketchat-Livechat-Token header is missing"}, HttpStatus.OK);
		}

		const message = request.body as RocketChatWebhook;

		if (!message.messages?.[0]?.agentId) {
			throw new HttpException({message: "Not an agent message"}, HttpStatus.OK);
		}

		const agentEmail = message?.agent?.email;
		if (!agentEmail) {
			throw new HttpException({message: "Invalid webhook format"}, HttpStatus.OK);
		}

		const user = await this.db.findUser(agentEmail);
		if (!user) {
			throw new HttpException({message: "No user with such credentials"}, HttpStatus.OK);
		}

		const workspace = await this.db.findWorkspaceById(user.workspaceId);
		if (!workspace || workspace.webhookToken !== token) {
			throw new HttpException({message: "Invalid webhook token"}, HttpStatus.OK);
		}

		const instance = await this.db.findInstanceByPhoneNumber(
			`${message.visitor.token.split(":")[1]}@c.us`, workspace.id,
		);
		if (!instance) {
			throw new HttpException({message: "Instance by phone number is not found"}, HttpStatus.OK);
		}

		request.instance = instance;
		return true;
	}
}
