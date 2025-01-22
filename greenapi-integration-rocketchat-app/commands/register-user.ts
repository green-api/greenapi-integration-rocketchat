import {
	IHttp,
	IModify,
	IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
	ISlashCommand,
	SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";

export class RegisterUserCommand implements ISlashCommand {
	public command = "greenapi.register-user";
	public i18nParamsExample = "";
	public i18nDescription = "";
	public providesPreview = false;

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
		const [rocketChatId, rocketChatToken] = context.getArguments();

		if (!rocketChatId || !rocketChatToken) {
			return this.sendMessage(context, modify, "You must provide the following values:\n" +
				"1. ID of your personal token\n" +
				"2. Your personal token itself");
		}
		const appUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");
		const rocketChatUrl = await read.getEnvironmentReader().getServerSettings().getValueById("Site_Url");
		const commandToken = await read.getEnvironmentReader().getSettings().getValueById("command_token");

		const response = await http.post(`${appUrl}/register-user`,
			{
				data: {
					rocketChatUrl,
					rocketChatId,
					rocketChatToken,
					commandToken,
					email: context.getSender().emails[0].address,
					type: "register-user",
				},
			});
		if (response.statusCode !== 200) {
			return this.sendMessage(context, modify, `Error: ${response.data.error}: ${response.data.message}`);
		}
		return this.sendMessage(context, modify, "Successfully registered in the workspace. You can now create instances.");
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
