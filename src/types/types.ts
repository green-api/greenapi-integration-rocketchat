export interface RocketChatWebhook {
	url: string;
	_id: string;
	label: string;
	createdAt: string;
	lastMessageAt: string;
	visitor: {
		_id: string;
		token: string;
		name: string;
		username: string;
		phone: {
			phoneNumber: string;
		}[];
	};
	agent: {
		_id: string;
		username: string;
		name: string;
		email: string;
	};
	type: string;
	messages: {
		u: {
			_id: string;
			username: string;
			name: string;
		};
		_id: string;
		username: string;
		msg?: string;
		ts: string;
		rid: string;
		agentId: string;
		_updatedAt: string;
		attachments?: {
			imageUrl: string;
			description?: string;
			title?: {
				value: string | null;
				link: string;
			};
			author?: {
				name: string;
				link: string | null;
				icon: string;
			};
			timestampLink?: string;
			_unmappedProperties_?: {
				attachments?: {
					title: string;
				}[];
			};
		}[];
	}[];
}

export interface TransformedRocketChatWebhook {
	token: string;
	name: string;
	id: string;
	msg?: string;
	file?: {
		url: string;
		fileName: string;
		caption?: string;
		mimeType: string;
	};
}

interface BaseCommandData {
	email: string;
	rocketChatId: string;
	rocketChatUrl: string;
	commandToken: string;
	roles: string[];
}

export interface RegisterWorkspaceCommand {
	type: "register-workspace";
	rocketChatUrl: string;
	rocketChatId: string;
	rocketChatToken: string;
	email: string;
	roles: string[];
}

export interface RegisterAgentCommand extends BaseCommandData {
	type: "register-agent";
	rocketChatToken: string;
	webhookToken: string;
}

export interface UpdateUserCommand extends BaseCommandData {
	type: "update-token";
	rocketChatToken: string;
}

export interface CreateInstanceCommand extends BaseCommandData {
	type: "create-instance";
	idInstance: number;
	apiTokenInstance: string;
}

export interface RemoveInstanceCommand extends BaseCommandData {
	type: "remove-instance";
	idInstance: number;
}

export interface SyncAppUrlCommand extends BaseCommandData {
	type: "sync-app-url";
	appUrl: string;
}

export interface ListInstancesCommand extends BaseCommandData {
	type: "list-instances";
}

export interface ListUsersCommand extends BaseCommandData {
	type: "list-users";
}

export type AdminCommand =
	| RegisterWorkspaceCommand
	| ListInstancesCommand
	| ListUsersCommand
	| RemoveInstanceCommand
	| SyncAppUrlCommand;

export type AgentCommand =
	| RegisterAgentCommand
	| UpdateUserCommand
	| CreateInstanceCommand;

export type RocketChatCommand = AdminCommand | AgentCommand;
