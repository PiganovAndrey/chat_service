import { Inject, Injectable, LoggerService, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MarkReadMessageDto } from './dto/mark-read-message.dto';
import { AppError } from 'src/common/errors/app.error.enum';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import sha256 from 'sha256';
import { CreateMessageDto } from './dto/create-message.dto';
import { PageResponse } from './response/pagination.response';
import { MessageDto } from './dto/message.dto';
import { FilterOptionsDto } from './dto/filterOptions.dto';
import { SendMessageResponse } from './response/send-message.response';
import { dialogs, messages } from '@prisma/client';
import { SuccessResponse } from 'src/common/interfaces/success.response';

@Injectable()
export class MessageService {
    constructor(
        private readonly prisma: DatabaseService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
    ) {}

    async sendMessage(dto: CreateMessageDto): Promise<SendMessageResponse> {
        try {
            this.logger.log(`Attempting to send message with match_uid: ${dto.match_uid}`, MessageService.name);

            const exitingDialog = await this.prisma.dialogs.findFirst({ where: { match_uid: dto.match_uid } });
            if (exitingDialog) {
                this.logger.log(
                    `Dialog found for match_uid: ${dto.match_uid}. Creating new message.`,
                    MessageService.name
                );
                const newMessage = await this.createMessage(exitingDialog.id, dto);
                await this.prisma.dialogs.update({
                    where: { match_uid: dto.match_uid },
                    data: { updated_at: newMessage.created_at }
                });
                return {
                    message: 'Сообщение отправлено',
                    newMessage: newMessage.message_uid,
                    dialog: exitingDialog.id
                };
            }

            this.logger.log(
                `No existing dialog for match_uid: ${dto.match_uid}. Creating new dialog.`,
                MessageService.name
            );
            const newDialog = await this.prisma.dialogs.create({
                data: {
                    match_uid: dto.match_uid,
                    user1: dto.from_uid,
                    user2: dto.to_uid,
                    is_user1_favorite: !!dto.is_user1_favorite,
                    is_user2_favorite: !!dto.is_user2_favorite
                }
            });
            const newMessage = await this.createMessage(newDialog.id, dto);

            this.logger.log(`New dialog created with id: ${newDialog.id} and message sent.`, MessageService.name);
            return { message: 'Чат успешно создан', dialog: newDialog.id, newMessage: newMessage.message_uid };
        } catch (e) {
            this.logger.error('Error creating message or dialog', e);
            throw e;
        }
    }

    async getAllMessages(): Promise<messages[]> {
        try {
            this.logger.log('Fetching all messages.', MessageService.name);
            return await this.prisma.messages.findMany({ take: 100 });
        } catch (e) {
            this.logger.error('Error fetching all messages', e);
            throw e;
        }
    }

    async getMatchMessages(
        match_uid: string,
        filterOptions: FilterOptionsDto,
        user_uid: string
    ): Promise<PageResponse<MessageDto>> {
        try {
            this.logger.log(
                `Fetching messages for match_uid: ${match_uid} with filters`,
                filterOptions,
                MessageService.name
            );
            const count = await this.prisma.messages.count({
                where: {
                    match_uid,
                    NOT: {
                        deletedBy: {
                            has: user_uid
                        }
                    }
                }
            });
            const messages = await this.prisma.messages.findMany({
                where: {
                    match_uid,
                    NOT: { deletedBy: { has: user_uid } }
                },
                skip: filterOptions.skip,
                take: filterOptions.take,
                orderBy: { created_at: 'desc' },
                include: { replyToMessage: true }
            });
            return {
                result: messages.reverse(),
                take: filterOptions.take,
                totalItems: count
            };
        } catch (e) {
            this.logger.error('Error fetching match messages', e);
            throw e;
        }
    }

    async markAsRead(dto: MarkReadMessageDto): Promise<SuccessResponse> {
        try {
            this.logger.log(
                `Marking message as read with message_uid: ${dto.message_uid} and match_uid: ${dto.match_uid}`,
                MessageService.name
            );
            const message = await this.prisma.messages.findFirst({
                where: { message_uid: dto.message_uid, match_uid: dto.match_uid }
            });
            if (!message) {
                this.logger.warn(
                    `Message not found for message_uid: ${dto.message_uid} and match_uid: ${dto.match_uid}`,
                    MessageService.name
                );
                throw new NotFoundException(AppError.MESSAGE_NOT_EXIST);
            }
            await this.prisma.messages.update({
                where: { message_uid: dto.message_uid, match_uid: dto.match_uid },
                data: { isRead: true, read_time: new Date().toISOString() }
            });
            return { success: true };
        } catch (e) {
            this.logger.error('Error marking message as read', e);
            throw e;
        }
    }

    async updateMessageByMessageUid(dto: UpdateMessageDto): Promise<messages> {
        try {
            this.logger.log(`Updating message by message_uid: ${dto.message_uid}`, MessageService.name);
            const message = await this.prisma.messages.findFirst({ where: { message_uid: dto.message_uid } });
            if (!message) {
                this.logger.warn(`Message not found for message_uid: ${dto.message_uid}`, MessageService.name);
                throw new NotFoundException(AppError.MESSAGE_NOT_EXIST);
            }
            await this.prisma.dialogs.update({
                where: { match_uid: message.match_uid },
                data: { updated_at: message.created_at }
            });
            return await this.prisma.messages.update({
                where: { message_uid: dto.message_uid },
                data: { content: dto.content, isEdit: true }
            });
        } catch (e) {
            this.logger.error('Error updating message by message_uid', e);
            throw e;
        }
    }

    async updateMessage(dto: UpdateMessageDto): Promise<messages> {
        try {
            this.logger.log(`Updating message with id: ${dto.id}`, MessageService.name);
            const message = await this.prisma.messages.findFirst({ where: { id: dto.id } });
            if (!message) {
                this.logger.warn(`Message not found for id: ${dto.id}`, MessageService.name);
                throw new NotFoundException(AppError.MESSAGE_NOT_EXIST);
            }
            return await this.prisma.messages.update({
                where: { id: dto.id },
                data: { content: dto.content, isEdit: true }
            });
        } catch (e) {
            this.logger.error('Error updating message', e);
            throw e;
        }
    }

    async deleteMessagesByMessageUids(message_uids: string[]): Promise<SuccessResponse> {
        try {
            this.logger.log(`Deleting messages with message_uids: ${message_uids}`, MessageService.name);
            for (const message_uid of message_uids) {
                const message = await this.prisma.messages.findFirst({
                    where: { message_uid },
                    include: { dialog: { select: { pinMessage: true, last_message: true } } }
                });
                if (!message) {
                    this.logger.warn(`Message not found for message_uid: ${message_uid}`, MessageService.name);
                    throw new NotFoundException(AppError.MESSAGE_NOT_EXIST);
                }
                if (message.replyInToUid != undefined && message.replyInToUid) {
                    await this.prisma.messages.update({
                        where: { message_uid: message.replyInToUid },
                        data: { replyToMessageUid: null } // Проверить replyToMessage: undefined
                    });
                }
                if (message.dialog?.pinMessage != undefined && message.dialog?.pinMessage) {
                    await this.prisma.dialogs.update({
                        where: { match_uid: message.match_uid },
                        data: { pinMessageUid: null, pinnedBy: [] } // Проверить pinMessage: undefined
                    });
                }
                if (message.dialog.last_message != undefined && message.dialog.last_message) {
                    await this.prisma.dialogs.update({
                        where: { match_uid: message.match_uid },
                        data: { lastMessageId: null }
                    });
                }
                await this.prisma.messages.delete({ where: { message_uid: message.message_uid } });
            }
            this.logger.log('Messages successfully deleted', MessageService.name);
            return { success: true };
        } catch (e) {
            this.logger.error('Error deleting messages by message_uid', e);
            throw e;
        }
    }

    async addReplyMessage(dto: ReplyMessageDto): Promise<messages> {
        try {
            this.logger.log(
                `Adding reply message with reply_message_uid: ${dto.reply_message_uid}`,
                MessageService.name
            );
            const messageUid = sha256(dto.from_uid + dto.to_uid + dto.match_uid + dto.sent_time + dto.content);
            const exitingDialog = await this.prisma.dialogs.findFirst({ where: { match_uid: dto.match_uid } });
            if (exitingDialog) {
                const message = await this.prisma.messages.create({
                    data: {
                        message_uid: messageUid,
                        match_uid: dto.match_uid,
                        from_uid: dto.from_uid,
                        content: dto.content,
                        sent_time: dto.sent_time,
                        dialog: { connect: { id: exitingDialog.id } },
                        replyToMessage: { connect: { message_uid: dto.reply_message_uid } }
                    },
                    include: { replyToMessage: true }
                });
                await this.prisma.messages.update({
                    where: { message_uid: dto.reply_message_uid },
                    data: { replyInToUid: messageUid }
                });
                this.logger.log('Reply message added successfully', MessageService.name);
                return message;
            } else {
                this.logger.warn(`Dialog not found for match_uid: ${dto.match_uid}`, MessageService.name);
                throw new NotFoundException(AppError.DIALOG_NOT_EXIST);
            }
        } catch (e) {
            this.logger.error('Error adding reply message', e);
            throw e;
        }
    }

    async markAsDeleteForMe(user_uid: string, message_uids: string[]): Promise<SuccessResponse> {
        try {
            this.logger.log(`Marking messages as deleted for user_uid: ${user_uid}`, MessageService.name);
            for (const message_uid of message_uids) {
                const message = await this.prisma.messages.findFirst({
                    where: { message_uid },
                    include: { dialog: { select: { pinMessage: true } } }
                });
                if (!message) {
                    this.logger.warn(`Message not found for message_uid: ${message_uid}`, MessageService.name);
                    throw new NotFoundException(AppError.MESSAGE_NOT_EXIST);
                }
                if (message.dialog?.pinMessage != undefined && message.dialog?.pinMessage) {
                    const updatedDeletedBy = message.deletedBy.filter((uid) => uid !== user_uid);
                    await this.prisma.dialogs.update({
                        where: { match_uid: message.match_uid },
                        data: { pinnedBy: updatedDeletedBy }
                    });
                }
                await this.prisma.messages.update({ where: { message_uid }, data: { deletedBy: { push: user_uid } } });
            }
            this.logger.log('Messages successfully marked as deleted for user', MessageService.name);
            return { success: true };
        } catch (e) {
            this.logger.error('Error marking messages as deleted for user', e);
            throw e;
        }
    }

    async setPinMessage(
        message_uid: string,
        value: boolean,
        match_uid: string,
        user_uid: string,
        to_uid: string
    ): Promise<dialogs> {
        try {
            this.logger.log(`Setting pin message with message_uid: ${message_uid} to ${value}`, MessageService.name);
            const message = await this.prisma.messages.findFirst({ where: { message_uid } });
            if (!message) {
                this.logger.warn(`Message not found for message_uid: ${message_uid}`, MessageService.name);
                throw new NotFoundException(AppError.MESSAGE_NOT_EXIST);
            }
            if (value) {
                return await this.prisma.dialogs.update({
                    where: { match_uid },
                    data: { pinMessage: { connect: { message_uid } }, pinnedBy: { push: [user_uid, to_uid] } },
                    include: { pinMessage: true }
                });
            } else {
                return await this.prisma.dialogs.update({
                    where: { match_uid },
                    data: { pinMessageUid: null, pinnedBy: [] }, // pinMessage: undefined
                    include: { pinMessage: true }
                });
            }
        } catch (e) {
            this.logger.error('Error setting pin message', e);
            throw e;
        }
    }

    async setPinMessageForSelf(message_uid: string, value: boolean, match_uid: string, user_uid: string) {
        try {
            const message = await this.prisma.messages.findFirst({ where: { message_uid } });
            if (!message) {
                throw new Error('По данному message_uid не найдено сообщения');
            }
            if (value) {
                return await this.prisma.dialogs.update({
                    where: { match_uid },
                    data: { pinMessage: { connect: { message_uid } }, pinnedBy: { push: user_uid } },
                    include: { pinMessage: true }
                });
            } else {
                return await this.prisma.dialogs.update({
                    where: { match_uid },
                    data: { pinMessageUid: null, pinnedBy: [] }, // pinMessage: undefined
                    include: { pinMessage: true }
                });
            }
        } catch (e) {
            this.logger.error('Error set pin message');
            throw e;
        }
    }

    private async createMessage(dialogId: string, dto: CreateMessageDto): Promise<messages> {
        try {
            this.logger.log(`Creating message with dialogId: ${dialogId}`, MessageService.name);
            const messageUid = sha256(dto.from_uid + dto.to_uid + dto.match_uid + dto.sent_time + dto.content);
            const message = await this.prisma.messages.create({
                data: {
                    message_uid: messageUid,
                    match_uid: dto.match_uid,
                    from_uid: dto.from_uid,
                    content: dto.content,
                    sent_time: dto.sent_time,
                    dialog: { connect: { id: dialogId } }
                }
            });
            await this.prisma.dialogs.update({
                where: { id: dialogId },
                data: { last_message: { connect: { message_uid: message.message_uid } } }
            });
            return message;
        } catch (e) {
            this.logger.error('Error creating message', e);
            throw e;
        }
    }
}
