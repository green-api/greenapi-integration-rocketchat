import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RocketChatCommand } from "../../types/types";

@Injectable()
export class RocketChatCommandGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const command = request.params.command;
		if (command === "register") {
			return true;
		}

		const message = request.body as RocketChatCommand;
		const agentEmail = message?.email;

		if (!agentEmail) {
			throw new UnauthorizedException("Invalid webhook format");
		}
		const user = await this.db.findUser(agentEmail);

		if (!user) {
			throw new UnauthorizedException("No user with such credentials");
		} else if (user.commandToken !== message.commandToken) {
			throw new UnauthorizedException("Invalid token");
		}

		request.user = user;
		return true;
	}
}
