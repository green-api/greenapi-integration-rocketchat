import {
	IHttp,
	IModify,
	IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
	ISlashCommand,
	SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";

export class CreateInstanceCommand implements ISlashCommand {
	public command = "greenapi.create-instance";
	public i18nParamsExample = "create-instance-param";
	public i18nDescription = "create-instance-desc";
	public providesPreview = false;

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
		const [idInstance, apiTokenInstance] = context.getArguments();

		if (!idInstance || !apiTokenInstance) {
			return this.sendMessage(context, modify, "You must provide the following values:\n" +
				"1. ID of your GREEN-API instance\n" +
				"2. Token of your GREEN-API instance");
		}
		const appUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");
		const commandToken = await read.getEnvironmentReader().getSettings().getValueById("command_token");
		const rocketChatUrl = await read.getEnvironmentReader().getServerSettings().getValueById("Site_Url");
		const roles = context.getSender().roles;

		const response = await http.post(`${appUrl}/create-instance`,
			{
				data: {
					idInstance,
					apiTokenInstance,
					commandToken,
					rocketChatUrl,
					email: context.getSender().emails[0].address,
					type: "create-instance",
					roles,
				},
			});
		if (response.statusCode !== 200) {
			return this.sendMessage(context, modify,
				`Error: ${response.data.error}: ${response.data.message}`);
		}
		return this.sendMessage(context, modify, `Successfully created instance with id ${idInstance}, 
            please wait for around 5 minutes for the settings to apply.`);
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
