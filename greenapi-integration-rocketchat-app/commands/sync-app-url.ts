import {
	IEnvironmentWrite,
	IHttp,
	IModify,
	IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
	ISlashCommand,
	SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";

export class SyncAppUrlCommand implements ISlashCommand {
	public command = "greenapi.sync-app-url";
	public i18nParamsExample = "";
	public i18nDescription = "sync-app-url-desc";
	public providesPreview = false;

	constructor(private readonly envWriter: IEnvironmentWrite) {}

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
		const [appUrl] = context.getArguments();
		if (!appUrl) {
			return this.sendMessage(context, modify, "You must provide the following values:\n" +
				"1. Your new APP_URL");
		}
		const oldAppUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");
		const commandToken = await read.getEnvironmentReader().getSettings().getValueById("command_token");
		const rocketChatUrl = await read.getEnvironmentReader().getServerSettings().getValueById("Site_Url");
		const roles = context.getSender().roles;

		const response = await http.post(`${oldAppUrl}/sync-app-url`,
			{
				data: {
					commandToken,
					rocketChatUrl,
					email: context.getSender().emails[0].address,
					type: "sync-app-url",
					appUrl,
					roles,
				},
			});
		if (response.statusCode !== 200) {
			return this.sendMessage(context, modify,
				`Error: ${response.data.error}: ${response.data.message}`);
		}
		await this.envWriter.getSettings().updateValue("app_url", appUrl);

		return this.sendMessage(context, modify, response.data.message);
	}

	public async sendMessage(context: SlashCommandContext, modify: IModify, message: string): Promise<void> {
		const messageStructure = modify.getCreator().startMessage();
		const sender = context.getSender();
		const room = context.getRoom();

		messageStructure
			.setSender(sender)
			.setRoom(room)
			.setText(message);

		await modify.getCreator().finish(messageStructure);
	}
}
