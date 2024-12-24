import {
	IHttp,
	IModify,
	IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
	ISlashCommand,
	SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";

export class RemoveInstanceCommand implements ISlashCommand {
	public command = "greenapi.remove-instance";
	public i18nParamsExample = "";
	public i18nDescription = "";
	public providesPreview = false;

	public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp): Promise<void> {
		const [idInstance, commandToken] = context.getArguments();

		if (!idInstance || !commandToken) {
			return this.sendMessage(context, modify, "You must provide the following values:\n" +
				"1. ID of your GREEN-API instance\n" +
				"2. Your command token");
		}
		const appUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");

		const response = await http.post(`${appUrl}/remove-instance`,
			{
				data: {
					idInstance,
					commandToken,
					email: context.getSender().emails[0].address,
					type: "remove-instance",
				},
			});
		if (response.statusCode !== 200) {
			return this.sendMessage(context, modify,
				`Error: ${response.data.error} ${response.data.statusCode}: ${response.data.message}`);
		}
		return this.sendMessage(context, modify, `Successfully removed instance with id ${idInstance}`);
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
