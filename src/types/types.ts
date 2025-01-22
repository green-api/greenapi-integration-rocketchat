export interface RocketChatWebhook {
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
		file?: {
			_id: string;
			name: string;
			type: string;
			size: number;
		};
		fileUpload?: {
			publicFilePath: string;
			type: string;
			size: number;
		};
		attachments?: {
			type: string;
			description?: string;
			title?: string;
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
}

export interface RegisterWorkspaceCommand {
	type: "register-workspace";
	rocketChatUrl: string;
	rocketChatId: string;
	rocketChatToken: string;
	email: string;
}

export interface RegisterUserCommand extends BaseCommandData {
	type: "register-user";
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

export type WorkspaceCommand = RegisterWorkspaceCommand;
export type AuthenticatedCommand =
    | RegisterUserCommand
    | UpdateUserCommand
    | CreateInstanceCommand
    | RemoveInstanceCommand
    | SyncAppUrlCommand;

export type RocketChatCommand = WorkspaceCommand | AuthenticatedCommand;
