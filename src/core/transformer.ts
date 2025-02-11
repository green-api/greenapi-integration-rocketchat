import {
	extractPhoneNumberFromVCard,
	GreenApiWebhook,
	IntegrationError,
	MessageTransformer, QuotedMessage,
} from "@green-api/greenapi-integration";
import { RocketChatWebhook, TransformedRocketChatWebhook } from "../types/types";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RocketChatTransformer extends MessageTransformer<RocketChatWebhook, TransformedRocketChatWebhook> {
	private formatQuotedMessage(quotedMessage: QuotedMessage): string {
		switch (quotedMessage.typeMessage) {
			case "textMessage":
				return `${quotedMessage.textMessage}`;

			case "contactMessage":
				const phone = extractPhoneNumberFromVCard(quotedMessage.contact.vcard);
				return `👤 Contact: ${quotedMessage.contact.displayName}${phone ? `\n📱 ${phone}` : ""}`;

			case "contactsArrayMessage":
				const contactsText = quotedMessage.contacts
					.map(contact => {
						const phone = extractPhoneNumberFromVCard(contact.vcard);
						return `👤 ${contact.displayName}${phone ? `\n📱 ${phone}` : ""}`;
					})
					.join("\n");
				return `Multiple contacts:\n${contactsText}`;

			case "locationMessage":
				const location = quotedMessage.location;
				return `📍 Location${location.nameLocation ? `: ${location.nameLocation}` : ""}
${location.address ? `📮 ${location.address}\n` : ""}
📌 https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

			case "imageMessage":
			case "videoMessage":
			case "documentMessage":
			case "audioMessage":
				return `📎 ${quotedMessage.typeMessage.replace("Message", "")}${quotedMessage.caption ? `\nCaption: ${quotedMessage.caption}` : ""}`;

			default:
				return `Unsupported message type`;
		}
	}

	// Transform GREEN-API webhook to RocketChat message format
	toPlatformMessage(webhook: GreenApiWebhook): TransformedRocketChatWebhook {
		if (webhook.typeWebhook === "incomingMessageReceived") {
			const baseMessage = {
				token: webhook.senderData.chatId,
				name: webhook.senderData.chatName || "WhatsApp User",
				id: webhook.idMessage,
			};

			// Handle quoted message if present
			const quotedMessageText = webhook.messageData.quotedMessage
				? `Quoted message:\nMessage: ${this.formatQuotedMessage(webhook.messageData.quotedMessage)}
From: ${webhook.messageData.quotedMessage.participant === webhook.instanceData.wid ? "Agent" : "User"}
ID: ${webhook.messageData.quotedMessage.stanzaId}\n\n`
				: "";

			switch (webhook.messageData.typeMessage) {
				case "quotedMessage":
					return {
						...baseMessage,
						msg: `${quotedMessageText}${webhook.messageData.extendedTextMessageData?.text || ""}`,
					};
				case "textMessage":
					return {
						...baseMessage,
						msg: `${quotedMessageText}${webhook.messageData.textMessageData?.textMessage || ""}`,
					};
				case "extendedTextMessage":
					return {
						...baseMessage,
						msg: `${quotedMessageText}${webhook.messageData.extendedTextMessageData?.text || ""}`,
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
						msg: `${quotedMessageText}${locationText}`,
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
						msg: `${quotedMessageText}${contactText}`,
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
						msg: `${quotedMessageText}${pollText}`,
					};
				}
				case "documentMessage":
				case "videoMessage":
				case "imageMessage":
				case "audioMessage":
					return {
						...baseMessage,
						msg: quotedMessageText,
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
						msg: `${quotedMessageText}System error: 'Unsupported message type'`,
					};
			}
		}
		throw new IntegrationError(`Unsupported webhook type: ${webhook.typeWebhook}`, "INTEGRATION_ERROR");
	}

	// Transform RocketChat webhook to GREEN-API message format
	toGreenApiMessage(webhook: RocketChatWebhook) {
		const message = webhook.messages[0];
		const chatId = webhook.visitor.username.split(":")[1];
		let quotedMessageId: string | undefined;

		const isAgentQuote = message.attachments?.[0]?.author?.name !== "Damir";

		if (!isAgentQuote) {
			if (message.attachments?.[1]?._unmappedProperties_?.attachments?.[0]?.title?.includes(":greenapi:")) {
				quotedMessageId = message.attachments[1]._unmappedProperties_.attachments[0].title.split(":greenapi:")[0];
			} else if (message.attachments?.[0]?._unmappedProperties_?.attachments?.[0]?.title?.includes(":greenapi:")) {
				quotedMessageId = message.attachments[0]._unmappedProperties_.attachments[0].title.split(":greenapi:")[0];
			} else if (message.msg?.includes("?msg=")) {
				quotedMessageId = message.msg.split("?msg=")[1].split("greenapi:")[1].split(")")[0];
			}
		}

		if (message.fileUpload) {
			return {
				type: "url-file" as const,
				chatId,
				file: {
					url: message.fileUpload.publicFilePath,
					fileName: message.file?.name || "file",
				},
				caption: message.attachments?.[0]?.description,
				quotedMessageId,
			};
		}

		return {
			type: "text" as const,
			chatId,
			message: message.msg?.startsWith("[ ](") ? message.msg.split(")\n")[1] : message.msg,
			quotedMessageId,
		};
	}
}
