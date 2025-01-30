import {
	IHttp,
	IModify,
	IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
	ISlashCommand,
	SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";

export class UpdateTokenCommand implements ISlashCommand {
	public command = "greenapi.update-token";
	public i18nParamsExample = "update-token-param";
	public i18nDescription = "update-token-desc";
	public providesPreview = false;

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
		const [rocketChatId, rocketChatToken] = context.getArguments();

		if (!rocketChatId || !rocketChatToken) {
			return this.sendMessage(context, modify, "You must provide the following values:\n" +
				"1. Your rocket chat ID\n" +
				"2. The new token");
		}
		const appUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");
		const commandToken = await read.getEnvironmentReader().getSettings().getValueById("command_token");
		const rocketChatUrl = await read.getEnvironmentReader().getServerSettings().getValueById("Site_Url");
		const roles = context.getSender().roles;

		const response = await http.post(`${appUrl}/update-token`,
			{
				data: {
					rocketChatId,
					rocketChatToken,
					commandToken,
					rocketChatUrl,
					email: context.getSender().emails[0].address,
					type: "update-token",
					roles,
				},
			});
		if (response.statusCode !== 200) {
			return this.sendMessage(context, modify,
				`Error: ${response.data.error}: ${response.data.message}`);
		}
		return this.sendMessage(context, modify, `Successfully updated rocket.chat token`);
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
