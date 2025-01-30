import {
	IHttp,
	IModify,
	IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
	ISlashCommand,
	SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";

export class ListUsersCommand implements ISlashCommand {
	public command = "greenapi.list-users";
	public i18nParamsExample = "";
	public i18nDescription = "list-users-desc";
	public providesPreview = false;

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
		const appUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");
		const commandToken = await read.getEnvironmentReader().getSettings().getValueById("command_token");
		const rocketChatUrl = await read.getEnvironmentReader().getServerSettings().getValueById("Site_Url");
		const roles = context.getSender().roles;

		const response = await http.post(`${appUrl}/list-users`,
			{
				data: {
					commandToken,
					rocketChatUrl,
					email: context.getSender().emails[0].address,
					type: "list-users",
					roles,
				},
			});

		if (response.statusCode !== 200) {
			return this.sendMessage(context, modify,
				`Error: ${response.data.error}: ${response.data.message}`);
		}
		return this.sendMessage(context, modify, response.data.message);
	}

	private async sendMessage(context: SlashCommandContext, modify: IModify, message: string): Promise<void> {
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
