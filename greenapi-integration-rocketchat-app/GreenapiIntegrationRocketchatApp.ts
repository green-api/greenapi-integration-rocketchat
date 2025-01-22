import {
	IAppAccessors,
	IConfigurationExtend,
	ILogger,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { SettingType } from "@rocket.chat/apps-engine/definition/settings";
import { CreateInstanceCommand } from "./commands/create-instance";
import { RegisterUserCommand } from "./commands/register-user";
import { RemoveInstanceCommand } from "./commands/remove-instance";
import { UpdateTokenCommand } from "./commands/update-token";
import { SyncAppUrlCommand } from "./commands/sync-app-url";
import { RegisterWorkspaceCommand } from "./commands/register-workspace";

export class GreenapiIntegrationRocketchatApp extends App {
	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	public async extendConfiguration(configuration: IConfigurationExtend) {
		await configuration.settings.provideSetting({
			id: "app_url",
			type: SettingType.STRING,
			packageValue: "",
			public: true,
			required: true,
			i18nLabel: "App URL",
			i18nDescription: "The base URL for API requests. Change it only if you are using your own version of GREEN-API adapter.",
		});
		await configuration.settings.provideSetting({
			id: "command_token",
			type: SettingType.STRING,
			packageValue: "",
			public: false,
			required: false,
			i18nLabel: "Command token",
			i18nDescription: "The command token for API requests. You will need to manually input here the generated token after you call the 'greenapi.register' command.",
		});
		await configuration.slashCommands.provideSlashCommand(new RegisterUserCommand());
		await configuration.slashCommands.provideSlashCommand(new CreateInstanceCommand());
		await configuration.slashCommands.provideSlashCommand(new RemoveInstanceCommand());
		await configuration.slashCommands.provideSlashCommand(new UpdateTokenCommand());
		await configuration.slashCommands.provideSlashCommand(new SyncAppUrlCommand());
		await configuration.slashCommands.provideSlashCommand(new RegisterWorkspaceCommand());
	}
}
