import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { RocketChatCommand } from "../../types/types";

@Injectable()
export class RocketChatCommandGuard implements CanActivate {
	constructor(private readonly db: DatabaseService) {}

	private readonly ADMIN_COMMANDS = [
		"register-workspace",
		"list-instances",
		"list-users",
		"remove-instance",
		"sync-app-url",
		"update-token",
	];

	private readonly AGENT_COMMANDS = [
		"register-agent",
		"create-instance",
		"update-token",
	];

	private async validateCommand(roles: string[], email: string, message: RocketChatCommand): Promise<boolean> {
		if (this.ADMIN_COMMANDS.includes(message.type)) {
			if (!roles.includes("admin")) {
				throw new UnauthorizedException(
					`This command requires 'admin' role. Your roles: ${roles.join(", ")}`,
				);
			}
			return true;
		}

		if (this.AGENT_COMMANDS.includes(message.type)) {
			if (!roles.includes("livechat-agent")) {
				throw new UnauthorizedException(
					`This command requires 'livechat-agent' role. Your roles: ${roles.join(", ")}`,
				);
			}

			if (message.type === "register-agent" || message.type === "update-token") {
				try {
					const response = await fetch(`${message.rocketChatUrl}/api/v1/me`, {
						headers: {
							"X-User-Id": message.rocketChatId,
							"X-Auth-Token": message.rocketChatToken,
						},
					});

					if (!response.ok) {
						throw new UnauthorizedException("Invalid RocketChat credentials");
					}

					const data = await response.json();
					const hasMatchingEmail = data.emails?.some((e: { address: string; }) => e.address === email);

					if (!hasMatchingEmail) {
						throw new UnauthorizedException(
							"RocketChat credentials do not match your email. For security reasons, " +
							"users can only register themselves as agents - you cannot register another " +
							"user as an agent.",
						);
					}
				} catch (error) {
					throw new UnauthorizedException("Failed to verify RocketChat credentials");
				}
			}

			if (message.type !== "register-agent") {
				const user = await this.db.findUser(email);
				if (!user) {
					throw new UnauthorizedException(
						"You need to register as an agent first using /greenapi.register-agent",
					);
				}
			}
			return true;
		}

		return false;
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const message = request.body as RocketChatCommand;
		const roles = message.roles || [];
		await this.validateCommand(roles, message.email, message);

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
