import {
	IAppAccessors,
	IConfigurationExtend, IHttp,
	ILogger, IModify, IPersistence, IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { SettingType } from "@rocket.chat/apps-engine/definition/settings";
import { CreateInstanceCommand } from "./commands/create-instance";
import { RegisterAgentCommand } from "./commands/register-agent";
import { RemoveInstanceCommand } from "./commands/remove-instance";
import { UpdateTokenCommand } from "./commands/update-token";
import { SyncAppUrlCommand } from "./commands/sync-app-url";
import { RegisterWorkspaceCommand } from "./commands/register-workspace";
import { ListUsersCommand } from "./commands/list-users";
import { ListInstancesCommand } from "./commands/list-instances";
import { IMessage, IPostMessageSent } from "@rocket.chat/apps-engine/definition/messages";

export class GreenapiIntegrationRocketchatApp extends App implements IPostMessageSent {
	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	public async extendConfiguration(configuration: IConfigurationExtend) {
		await configuration.settings.provideSetting({
			id: "app_url",
			type: SettingType.STRING,
			packageValue: "https://rocketchat.int.green-api.com/api/webhook/rocket",
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
			i18nDescription: "The command token for API requests.",
		});
		await configuration.settings.provideSetting({
			id: "webhook_token",
			type: SettingType.STRING,
			packageValue: "",
			public: false,
			required: false,
			i18nLabel: "Webhook token",
			i18nDescription: "The webhook token for sending agent message to the integration.",
		});
		await configuration.slashCommands.provideSlashCommand(new RegisterAgentCommand());
		await configuration.slashCommands.provideSlashCommand(new CreateInstanceCommand());
		await configuration.slashCommands.provideSlashCommand(new RemoveInstanceCommand());
		await configuration.slashCommands.provideSlashCommand(new UpdateTokenCommand());
		await configuration.slashCommands.provideSlashCommand(
			new SyncAppUrlCommand(this.getAccessors().environmentWriter),
		);
		await configuration.slashCommands.provideSlashCommand(
			new RegisterWorkspaceCommand(this.getAccessors().environmentWriter),
		);
		await configuration.slashCommands.provideSlashCommand(new ListUsersCommand());
		await configuration.slashCommands.provideSlashCommand(new ListInstancesCommand());
	}

	public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, _: IPersistence, modify: IModify): Promise<void> {
		if (message.room.type !== "l") {
			this.getLogger().warn("Skipping non-livechat room message");
			return;
		}

		if ("token" in message || message.sender.type !== "user" || message.text?.startsWith("GA Error: ⚠️ Message")) {
			this.getLogger().warn("Skipping non-agent message or notification message");
			return;
		}

		const messageData = await read.getMessageReader().getById(message.id!) as any;

		if (!messageData) {
			this.getLogger().warn("Could not get message data");
			return;
		}

		const visitor = messageData.room.visitor;
		if (!visitor || !visitor.token || !visitor.token.startsWith("greenapi:")) {
			this.getLogger().warn("No valid visitor data found");
			return;
		}
		const appUrl = await read.getEnvironmentReader().getSettings().getValueById("app_url");
		const webhookToken = await read.getEnvironmentReader().getSettings().getValueById("webhook_token");
		const rocketChatUrl = await read.getEnvironmentReader().getServerSettings().getValueById("Site_Url");

		const webhook = {
			url: rocketChatUrl,
			_id: messageData.id,
			label: messageData.room.displayName,
			createdAt: messageData.createdAt,
			lastMessageAt: messageData.updatedAt,
			visitor: {
				_id: visitor.id,
				token: visitor.token,
				name: visitor.name,
				username: visitor.username,
				phone: [{
					phoneNumber: visitor.phone[0].phoneNumber,
				}],
			},
			agent: {
				_id: messageData.room.servedBy.id,
				username: messageData.room.servedBy.username,
				name: messageData.room.servedBy.name,
				email: messageData.room.servedBy.emails[0].address,
			},
			type: "message",
			messages: [{
				u: {
					_id: messageData.room.servedBy.id,
					username: messageData.room.servedBy.username,
					name: messageData.room.servedBy.name,
				},
				_id: messageData.id,
				username: messageData.room.servedBy.username,
				msg: messageData.text,
				ts: messageData.createdAt,
				rid: messageData.room.id,
				agentId: messageData.room.servedBy.id,
				_updatedAt: messageData.updatedAt,
				attachments: messageData.attachments || undefined,
			}],
		};

		try {
			const response = await http.post(appUrl, {
				data: webhook,
				headers: {
					"Content-Type": "application/json",
					"X-Rocketchat-Livechat-Token": webhookToken,
				},
			});

			if (response.statusCode === 200 && response.data?.message) {
				const messageStructure = modify.getCreator().startMessage()
					.setSender(message.sender)
					.setRoom(message.room)
					.setText(`GA Error: ⚠️ Message not delivered: ${response.data.message}`);

				await modify.getCreator().finish(messageStructure);
			}
		} catch (error) {
			this.getLogger().error("Error sending message:", error);
			const messageStructure = modify.getCreator().startMessage()
				.setSender(message.sender)
				.setRoom(message.room)
				.setText("GA Error: ⚠️ Message could not be delivered due to a network error");

			await modify.getCreator().finish(messageStructure);
		}
	}
}
