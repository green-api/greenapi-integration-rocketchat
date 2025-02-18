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

			case "stickerMessage":
				return `📎 ${quotedMessage.typeMessage.replace("Message", "")}${quotedMessage.caption ? `\nCaption: ${quotedMessage.caption}` : ""}`;

			case "buttonsMessage":
				const buttonsList = quotedMessage.buttons
					.map(button => `• ${button.buttonText}`)
					.join("\n");
				return `🔘 Message with buttons:\n${quotedMessage.contentText}\n\nButtons:\n${buttonsList}`;

			case "listMessage":
				const sectionsList = quotedMessage.sections
					.map(section => {
						const options = section.rows
							.map(row => `  • ${row.title}${row.description ? `: ${row.description}` : ""}`)
							.join("\n");
						return `${section.title}:\n${options}`;
					})
					.join("\n\n");
				return `📝 List message:\n${quotedMessage.contentText}\n\n${sectionsList}`;

			case "templateMessage":
				const templateButtons = quotedMessage.buttons
					.map(button => {
						if (button.urlButton) return `• Link: ${button.urlButton.displayText}`;
						if (button.callButton) return `• Call: ${button.callButton.displayText}`;
						if (button.quickReplyButton) return `• Reply: ${button.quickReplyButton.displayText}`;
						return null;
					})
					.filter(Boolean)
					.join("\n");
				return `📋 Template message:\n${quotedMessage.contentText}\n\n${templateButtons}`;

			case "groupInviteMessage":
				const invite = quotedMessage.groupInviteMessageData;
				return `👥 Group invitation: ${invite.groupName}\n📝 ${invite.caption}`;

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
				case "editedMessage": {
					const editedText = webhook.messageData.editedMessageData?.textMessage ??
						webhook.messageData.editedMessageData?.caption ?? "";

					return {
						...baseMessage,
						msg: `✏️ Message edited:\n${editedText}\nID: ${webhook.messageData.editedMessageData?.stanzaId}`,
					};
				}
				case "deletedMessage": {
					return {
						...baseMessage,
						msg: `🗑️ Message deleted\nID: ${webhook.messageData.deletedMessageData?.stanzaId || "unknown"}`,
					};
				}
				case "buttonsMessage": {
					const buttons = webhook.messageData.buttonsMessage;
					const buttonsList = buttons.buttons
						.map(button => `• ${button.buttonText}`)
						.join("\n");
					return {
						...baseMessage,
						msg: `${quotedMessageText}🔘 ${buttons.contentText}\n\nButtons:\n${buttonsList}${buttons.footer ? `\n\n${buttons.footer}` : ""}`,
					};
				}

				case "listMessage": {
					const list = webhook.messageData.listMessage;
					const sections = list.sections
						.map(section => {
							const options = section.rows
								.map(row => `  • ${row.title}${row.description ? `: ${row.description}` : ""}`)
								.join("\n");
							return `${section.title}:\n${options}`;
						})
						.join("\n\n");
					return {
						...baseMessage,
						msg: `${quotedMessageText}📝 ${list.contentText}\n\n${sections}${list.footer ? `\n\n${list.footer}` : ""}`,
					};
				}

				case "templateMessage": {
					const template = webhook.messageData.templateMessage;
					const buttons = template.buttons
						.map(button => {
							if (button.urlButton) return `• Link: ${button.urlButton.displayText}`;
							if (button.callButton) return `• Call: ${button.callButton.displayText}`;
							if (button.quickReplyButton) return `• Reply: ${button.quickReplyButton.displayText}`;
							return null;
						})
						.filter(Boolean)
						.join("\n");
					return {
						...baseMessage,
						msg: `${quotedMessageText}📋 ${template.contentText}\n\n${buttons}${template.footer ? `\n\n${template.footer}` : ""}`,
					};
				}

				case "groupInviteMessage": {
					const invite = webhook.messageData.groupInviteMessageData;
					return {
						...baseMessage,
						msg: `${quotedMessageText}👥 Group Invitation\n📝 Group: ${invite.groupName}\n${invite.caption}`,
					};
				}

				case "stickerMessage":
					return {
						...baseMessage,
						msg: quotedMessageText,
						file: {
							url: webhook.messageData.fileMessageData.downloadUrl,
							fileName: webhook.messageData.fileMessageData.fileName,
							caption: webhook.messageData.fileMessageData.caption,
							mimeType: webhook.messageData.fileMessageData.mimeType,
						},
					};
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

		if (message.attachments?.[1]?._unmappedProperties_?.attachments?.[0]?.title?.includes(":greenapi:")) {
			quotedMessageId = message.attachments[1]._unmappedProperties_.attachments[0].title.split(":greenapi:")[0];
		} else if (message.attachments?.[0]?._unmappedProperties_?.attachments?.[0]?.title?.includes(":greenapi:")) {
			quotedMessageId = message.attachments[0]._unmappedProperties_.attachments[0].title.split(":greenapi:")[0];
		} else if (message.msg?.includes("?msg=")) {
			quotedMessageId = message.msg.split("?msg=")[1].split("greenapi:")[1].split(")")[0];
		}
		if (message.attachments?.[0] && (message.msg === "" || message.msg?.endsWith(")\n"))) {
			return {
				type: "url-file" as const,
				chatId,
				file: {
					url: webhook.url + message.attachments[0].title.link,
					fileName: message.attachments[0].title?.value || "file",
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
