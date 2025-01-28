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
			const baseMessage = {
				token: webhook.senderData.chatId,
				name: webhook.senderData.chatName || "WhatsApp User",
				id: webhook.idMessage,
			};

			switch (webhook.messageData.typeMessage) {
				case "textMessage":
					return {
						...baseMessage,
						msg: webhook.messageData.textMessageData?.textMessage || "",
					};
				case "extendedTextMessage":
					return {
						...baseMessage,
						msg: webhook.messageData.extendedTextMessageData?.text || "",
					};
				case "locationMessage": {
					const location = webhook.messageData.locationMessageData;
					const locationText = [
						location.nameLocation && `📍 ${location.nameLocation}`,
						location.address && `📮 ${location.address}`,
						`📌 https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
					].filter(Boolean).join("\n");

					return {
						...baseMessage,
						msg: locationText,
					};
				}
				case "contactMessage": {
					const contact = webhook.messageData.contactMessageData;
					const phone = extractPhoneNumberFromVCard(contact.vcard);
					const contactText = [
						"👤 Contact shared:",
						contact.displayName && `Name: ${contact.displayName}`,
						phone && `Phone: ${phone}`,
					].filter(Boolean).join("\n");

					return {
						...baseMessage,
						msg: contactText,
					};
				}
				case "contactsArrayMessage": {
					const contacts = webhook.messageData.messageData.contacts;
					const contactsText = [
						"👥 Multiple contacts shared:",
						"",
						...contacts.map(contact => {
							const phone = extractPhoneNumberFromVCard(contact.vcard);
							return [
								`👤 ${contact.displayName}`,
								phone && `📱 ${phone}`,
							].filter(Boolean).join("\n");
						}),
					].join("\n");

					return {
						...baseMessage,
						msg: contactsText,
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
						...baseMessage,
						msg: pollText,
					};
				}
				case "documentMessage":
				case "videoMessage":
				case "imageMessage":
				case "audioMessage":
					return {
						...baseMessage,
						file: {
							url: webhook.messageData.fileMessageData!.downloadUrl,
							fileName: webhook.messageData.fileMessageData!.fileName,
							caption: webhook.messageData.fileMessageData!.caption,
							mimeType: webhook.messageData.fileMessageData!.mimeType,
						},
					};
				default:
					return {
						...baseMessage,
						msg: "System error: 'Unsupported message type'",
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

		let quotedMessageId: string | undefined = undefined;

		if (message.msg.includes("?msg=")) {
			const msgContent = message.msg.split("?msg=")[1];
			if (msgContent.includes("greenapi:")) {
				quotedMessageId = msgContent.split("greenapi:")[1].split(")")[0];
			}
		}
		return {
			type: "text",
			chatId,
			message: this.removeQuotedPart(message.msg),
			quotedMessageId,
		};
	}

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
