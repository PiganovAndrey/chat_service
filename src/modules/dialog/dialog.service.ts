import { Inject, Injectable, LoggerService, NotFoundException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DatabaseService } from '../database/database.service';
import { CreateDialogDto } from './dto/create-dialog.dto';
import { AppError } from 'src/common/errors/app.error.enum';
import { CheckMatchDialogResponse } from './response/check-match-dialog.response';
import { dialogs } from '@prisma/client';
import { CreateDialogResponse } from './response/create-dialog.response';
import { UserDialogResponse } from './response/user-dialog.response';
import { SuccessResponse } from 'src/common/interfaces/success.response';
import { DialogResponse } from './response/dialog.response';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class DialogService {
    constructor(
        private readonly prisma: DatabaseService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
        @Inject('IMAGE_SERVICE') private readonly clientImage: ClientKafka,
        @Inject('USER_MOBILE_SERVICE') private readonly clientUser: ClientKafka
    ) {}

    async checkMatchDialog(match_uid: string): Promise<CheckMatchDialogResponse> {
        try {
            this.logger.log(`Checking match dialog for match_uid: ${match_uid}`, DialogService.name);
            const dialog = await this.prisma.dialogs.findFirst({ where: { match_uid } });
            return { dialogId: dialog?.id, success: true };
        } catch (e) {
            this.logger.error('Error checking dialog by match', e);
            throw e;
        }
    }

    async createDialog(dto: CreateDialogDto): Promise<CreateDialogResponse | dialogs> {
        try {
            this.logger.log(`Creating dialog with match_uid: ${dto.match_uid}`, DialogService.name);

            const dialog = await this.prisma.dialogs.findFirst({
                where: { match_uid: dto.match_uid },
                include: { pinMessage: true }
            });
            if (dialog) {
                this.logger.log(`Dialog already exists for match_uid: ${dto.match_uid}`, DialogService.name);
                return { message: 'Диалог уже существует', dialog };
            }
            const newDialog = await this.prisma.dialogs.create({
                data: {
                    match_uid: dto.match_uid,
                    user1: dto.user1,
                    user2: dto.user2
                }
            });

            this.logger.log(`New dialog created with id: ${newDialog.id}`, DialogService.name);
            return newDialog;
        } catch (e) {
            this.logger.error('Error creating dialog', e);
            this.logger.error(e);
            throw e;
        }
    }

    async getAllDialogs(): Promise<dialogs[]> {
        try {
            this.logger.log('Fetching all dialogs', DialogService.name);
            return await this.prisma.dialogs.findMany({ take: 100, include: { last_message: true } });
        } catch (e) {
            this.logger.error('Error fetching all dialogs', e);
            throw e;
        }
    }

    async getUserDialogs(user_uid: string): Promise<null | UserDialogResponse[]> {
        try {
            this.logger.log(`Fetching dialogs for user_uid: ${user_uid}`, DialogService.name);
            const dialogs = await this.prisma.dialogs.findMany({
                where: { OR: [{ user1: user_uid }, { user2: user_uid }] },
                take: 50,
                include: {
                    pinMessage: true,
                    message: { where: { NOT: { deletedBy: { has: user_uid } } } },
                    last_message: true
                },
                orderBy: {
                    updated_at: 'desc'
                }
            });

            if (!dialogs) {
                this.logger.warn(`No dialogs found for user_uid: ${user_uid}`, DialogService.name);
                return null;
            }

            const result = await Promise.all(
                dialogs.map(async (dialog) => {
                    const toUserUid = user_uid === dialog.user1 ? dialog.user2 : dialog.user1;
                    const toUser = await lastValueFrom(
                        this.clientUser.send('user.get', JSON.stringify({ uid: toUserUid }))
                    );

                    const images = await lastValueFrom(
                        this.clientImage.send('image.user.get', { created_at: 'asc', user_uid: toUserUid })
                    );
                    const unread_count = await this.prisma.messages.count({
                        where: { from_uid: toUserUid, isRead: false, match_uid: dialog.match_uid }
                    });

                    return { dialog, to_user: { ...toUser, images }, unread_count };
                })
            );

            this.logger.log(`User dialogs fetched successfully for user_uid: ${user_uid}`, DialogService.name);
            return result;
        } catch (e) {
            this.logger.error('Error fetching user dialogs', e);
            throw e;
        }
    }

    async deleteDialogByMatch(match_uid: string): Promise<SuccessResponse> {
        try {
            this.logger.log(`Deleting dialog by match_uid: ${match_uid}`, DialogService.name);
            const dialog = await this.prisma.dialogs.findFirst({ where: { match_uid } });

            if (!dialog) {
                this.logger.warn(`Dialog not found for match_uid: ${match_uid}`, DialogService.name);
                throw new NotFoundException(AppError.DIALOG_NOT_EXIST);
            }

            await this.prisma.dialogs.delete({ where: { match_uid } });
            this.logger.log(`Dialog deleted successfully for match_uid: ${match_uid}`, DialogService.name);
            return { success: true };
        } catch (e) {
            this.logger.error('Error deleting dialog by match', e);
            throw e;
        }
    }

    async deleteDialogById(id: string): Promise<SuccessResponse> {
        try {
            this.logger.log(`Deleting dialog by id: ${id}`, DialogService.name);
            const dialog = await this.prisma.dialogs.findFirst({ where: { id } });

            if (!dialog) {
                this.logger.warn(`Dialog not found for id: ${id}`, DialogService.name);
                throw new NotFoundException(AppError.DIALOG_NOT_EXIST);
            }
            await this.prisma.dialogs.delete({ where: { id } });
            this.logger.log(`Dialog deleted successfully for id: ${id}`, DialogService.name);
            return { success: true };
        } catch (e) {
            this.logger.error('Error deleting dialog', e);
            throw e;
        }
    }

    async getDialogByMatchUid(match_uid: string, userUid: string): Promise<null | DialogResponse> {
        try {
            this.logger.log(`Fetching dialog by match_uid: ${match_uid} for userUid: ${userUid}`, DialogService.name);
            const dialog = await this.prisma.dialogs.findFirst({
                where: { match_uid },
                include: {
                    pinMessage: { where: { NOT: { dialog: { pinnedBy: { has: userUid } } } } },
                    last_message: true
                }
            });

            if (!dialog) {
                this.logger.warn(`Dialog not found for match_uid: ${match_uid}`, DialogService.name);
                throw new NotFoundException(AppError.DIALOG_NOT_EXIST);
            }

            const toUserUid = userUid === dialog.user1 ? dialog.user2 : dialog.user1;
            const toUser = await lastValueFrom(this.clientUser.send('user.get', JSON.stringify({ uid: toUserUid })));
            const images = await lastValueFrom(
                this.clientImage.send('image.user.get', { created_at: 'asc', user_uid: toUserUid })
            );

            this.logger.log(`Dialog fetched successfully for match_uid: ${match_uid}`, DialogService.name);
            return { dialog, toUser: { ...toUser, images } };
        } catch (e) {
            this.logger.error('Error fetching dialog by match_uid', e);
            throw e;
        }
    }
}
