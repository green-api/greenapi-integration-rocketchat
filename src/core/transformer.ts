import {
	extractPhoneNumberFromVCard,
	GreenApiWebhook,
	IntegrationError,
	Message,
	MessageTransformer,
} from "@green-api/greenapi-integration";
import { RocketChatWebhook, TransformedRocketChatWebhook } from "../types/types";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RocketChatTransformer extends MessageTransformer<RocketChatWebhook, TransformedRocketChatWebhook> {
	// Transform GREEN-API webhook to RocketChat message format
	toPlatformMessage(webhook: GreenApiWebhook): TransformedRocketChatWebhook {
		if (webhook.typeWebhook === "incomingMessageReceived") {
			switch (webhook.messageData.typeMessage) {
				case "textMessage":
					return {
						token: webhook.senderData.chatId,
						msg: webhook.messageData.textMessageData?.textMessage || "",
						name: webhook.senderData.chatName || "WhatsApp User",
					};
				case "extendedTextMessage":
					return {
						token: webhook.senderData.chatId,
						msg: webhook.messageData.extendedTextMessageData?.text || "",
						name: webhook.senderData.chatName || "WhatsApp User",
					};
				case "locationMessage": {
					const location = webhook.messageData.locationMessageData;
					const locationText = [
						location.nameLocation && `📍 ${location.nameLocation}`,
						location.address && `📮 ${location.address}`,
						`📌 https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
					].filter(Boolean).join("\n");

					return {
						token: webhook.senderData.chatId,
						msg: locationText,
						name: webhook.senderData.chatName || "WhatsApp User",
					};
				}
				case "contactMessage": {
					const contact = webhook.messageData.contactMessageData;
					console.log(contact.vcard);
					const phone = extractPhoneNumberFromVCard(contact.vcard);
					const contactText = [
						"👤 Contact shared:",
						contact.displayName && `Name: ${contact.displayName}`,
						phone && `Phone: ${phone}`,
					].filter(Boolean).join("\n");

					return {
						token: webhook.senderData.chatId,
						msg: contactText,
						name: webhook.senderData.chatName || "WhatsApp User",
					};
				}
				case "pollMessage": {
					const poll = webhook.messageData.pollMessageData!;
					const pollText = [
						"📊 Poll: " + poll.name,
						"",
						"Options:",
						...poll.options.map((opt, index) => `${index + 1}. ${opt.optionName}`),
						"",
						poll.multipleAnswers ? "Multiple answers allowed" : "Single answer only",
					].join("\n");

					return {
						token: webhook.senderData.chatId,
						msg: pollText,
						name: webhook.senderData.chatName || "WhatsApp User",
					};
				}
				case "documentMessage":
				case "videoMessage":
				case "imageMessage":
				case "audioMessage":
					return {
						token: webhook.senderData.chatId,
						file: {
							url: webhook.messageData.fileMessageData!.downloadUrl,
							fileName: webhook.messageData.fileMessageData!.fileName,
							caption: webhook.messageData.fileMessageData!.caption,
							mimeType: webhook.messageData.fileMessageData!.mimeType,
						},
						name: webhook.senderData.chatName || "WhatsApp User",
					};
				default:
					return {
						token: webhook.senderData.chatId,
						msg: "System error: 'Unsupported message type'",
						name: webhook.senderData.chatName || "WhatsApp User",
					};
			}
		}
		throw new IntegrationError(`Unsupported webhook type: ${webhook.typeWebhook}`, "INTEGRATION_ERROR");
	}

	// Transform RocketChat webhook to GREEN-API message format
	toGreenApiMessage(webhook: RocketChatWebhook): Message {
		const message = webhook.messages[0];
		const chatId = webhook.visitor.username.split(":")[1];

		if (message.fileUpload) {
			return {
				type: "url-file",
				chatId,
				file: {
					url: message.fileUpload.publicFilePath,
					fileName: message.file?.name || "file",
				},
				caption: message.attachments?.[0]?.description,
			};
		}

		return {
			type: "text",
			chatId,
			message: this.removeQuotedPart(message.msg) || "",
		};
	}

	// a function to remove the quoted part of rocket.chat messages
	removeQuotedPart(msg: string) {
		if (msg.startsWith("[ ](")) {
			const quoteEnd = msg.indexOf(")\n");
			if (quoteEnd !== -1) {
				return msg.substring(quoteEnd + 2);
			}
		}
		return msg;
	}
}
