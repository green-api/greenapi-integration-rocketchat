import { IAppAccessors, IConfigurationExtend, ILogger } from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { SettingType } from "@rocket.chat/apps-engine/definition/settings";
import { CreateInstanceCommand } from "./commands/create-instance";
import { RegisterCommand } from "./commands/register";
import { RemoveInstanceCommand } from "./commands/remove-instance";
import { UpdateTokenCommand } from "./commands/update-token";

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
			i18nDescription: "The base URL for API requests. Change it only if you are using your own version of our adapter.",
		});
		await configuration.slashCommands.provideSlashCommand(new RegisterCommand());
		await configuration.slashCommands.provideSlashCommand(new CreateInstanceCommand());
		await configuration.slashCommands.provideSlashCommand(new RemoveInstanceCommand());
		await configuration.slashCommands.provideSlashCommand(new UpdateTokenCommand());
	}
}
