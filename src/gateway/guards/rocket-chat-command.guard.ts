import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RocketChatCommand } from "../../types/types";

@Injectable()
export class RocketChatCommandGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const message = request.body as RocketChatCommand;

		if (message.type === "register-workspace") {
			return true;
		}

		const {rocketChatUrl, commandToken} = message;
		if (!rocketChatUrl || !commandToken) {
			throw new UnauthorizedException("Workspace URL and command token are required");
		}

		const workspace = await this.db.findWorkspace(rocketChatUrl);
		if (!workspace) {
			throw new UnauthorizedException("Workspace not registered. Please use /greenapi.register-workspace first");
		}

		if (workspace.commandToken !== commandToken) {
			throw new UnauthorizedException("Invalid workspace command token");
		}

		return true;
	}
}
