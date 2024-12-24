import { MessageTransformer, Message, IncomingGreenApiWebhook, formatPhoneNumber } from "@green-api/greenapi-integration";
import { RocketChatWebhook, TransformedRocketChatWebhook } from "../types/types";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RocketChatTransformer extends MessageTransformer<RocketChatWebhook, TransformedRocketChatWebhook> {
	// Transform GREEN-API webhook to RocketChat message format
	toPlatformMessage(webhook: IncomingGreenApiWebhook): TransformedRocketChatWebhook {
		if (webhook.messageData.typeMessage === "textMessage") {
			return {
				token: webhook.senderData.chatId.replace("@c.us", ""),
				msg: webhook.messageData.textMessageData?.textMessage || "",
				name: webhook.senderData.chatName || "WhatsApp User",
			};
		}

		if (webhook.messageData.fileMessageData) {
			return {
				token: webhook.senderData.chatId.replace("@c.us", ""),
				file: {
					url: webhook.messageData.fileMessageData.downloadUrl,
					fileName: webhook.messageData.fileMessageData.fileName,
					caption: webhook.messageData.fileMessageData.caption,
					mimeType: webhook.messageData.fileMessageData.mimeType,
				},
				name: webhook.senderData.chatName || "WhatsApp User",
			};
		}

		throw new Error(`Unsupported message type: ${webhook.messageData.typeMessage}`);
	}

	// Transform RocketChat webhook to GREEN-API message format
	toGreenApiMessage(webhook: RocketChatWebhook): Message {
		const message = webhook.messages[0];

		if (message.fileUpload) {
			return {
				type: "url-file",
				chatId: formatPhoneNumber(webhook.visitor.token),
				file: {
					url: message.fileUpload.publicFilePath,
					fileName: message.file?.name || "file",
				},
				caption: message.attachments?.[0]?.description,
			};
		}

		return {
			type: "text",
			chatId: formatPhoneNumber(webhook.visitor.token),
			message: message.msg || "",
		};
	}
}
