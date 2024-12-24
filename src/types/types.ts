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
	commandToken?: string;
}

export interface RegisterUserData extends BaseCommandData {
	type: "register";
	rocketChatToken: string;
	webhookToken: string;
}

export interface UpdateUserData extends BaseCommandData {
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

export type RocketChatCommand = RegisterUserData | UpdateUserData | CreateInstanceCommand | RemoveInstanceCommand;
