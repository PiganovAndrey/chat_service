import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Inject,
    LoggerService,
    OnModuleInit,
    Param,
    ParseIntPipe,
    Put,
    Query,
    Req,
    UseInterceptors
} from '@nestjs/common';
import { MessageService } from './message.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CreateMessageDto } from './dto/create-message.dto';
import { AppError } from 'src/common/errors/app.error.enum';
import { MarkReadMessageDto } from './dto/mark-read-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { IDeleteForSelfDto } from './dto/delete-for-selt.dto';
import { SetPinMessageDto } from './dto/setPinMessageDto';
import { MatchUidDto } from 'src/common/dto/matchUid.dto';
import ITokenData from '../../common/interfaces/token.data';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Request } from 'express';
import { Role } from 'src/common/enums/roles.enum';
import { ClientKafka, KafkaRetriableException, MessagePattern, Payload } from '@nestjs/microservices';
import { LoggingInterceptor } from 'src/common/interceptors/LogginInterceptor';
import { SetPinForSelfMessageDto } from './dto/setPinMessageForSelf.dto';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/interfaces/success.response';

@ApiTags('message')
@Controller('message')
@UseInterceptors(LoggingInterceptor)

export class MessageController implements OnModuleInit{
    constructor(
        private readonly messageService: MessageService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
        @Inject('MATCH_SERVICE') private readonly client: ClientKafka,
    ) {}

    async onModuleInit() {
        this.client.subscribeToResponseOf('match.get');
        this.client.subscribeToResponseOf('match.dialog');

        await this.client.connect();
    }

    @Get('/')
    @ApiOperation({summary: 'Позволяет получить все сообщения из БД, метод доступен только админам'})
    @ApiResponse({status: 200, description: 'Возвращает все сообщения',})
    @Roles(Role.ADMIN)
    getAllMessages() {
        try {
            return this.messageService.getAllMessages();
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new HttpException('Ошибка при получении всех сообщений', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @MessagePattern('message.send')
    @Roles(Role.ALL)
    async sendMessage(@Payload() dto: CreateMessageDto) {
        try {
            const result = await this.messageService.sendMessage(dto);
            if (!result) {
                throw new BadRequestException(AppError.DIALOG_EXIST);
            }
            return result;
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при публикации сообщения');
        }
    }

    @MessagePattern('message.read')
    @Roles(Role.ALL)
    markAsRead(@Payload() dto: MarkReadMessageDto) {
        try {
            return this.messageService.markAsRead(dto);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошиба при добавление прочитанного сообщения');
        }
    }

    @MessagePattern('message.update.all')
    @Roles(Role.ALL)
    updateMessageByMessageUid(@Payload() dto: UpdateMessageDto) {
        try {
            return this.messageService.updateMessageByMessageUid(dto);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException(
                'Ошибка при изменения сообщения чата по message_uid',
            );
        }
    }

    @MessagePattern('message.update.admin')
    @Roles(Role.ADMIN)
    updateMessage(@Payload() dto: UpdateMessageDto) {
        try {
            return this.messageService.updateMessage(dto);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при изменении сообщения чата');
        }
    }

    @MessagePattern('message.delete')
    @Roles(Role.ALL)
    deleteMessagesByMessageUids(@Payload() message_uids: string[]) {
        try {
            return this.messageService.deleteMessagesByMessageUids(message_uids);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при удалении собщения по message_uid');
        }
    }

    @MessagePattern('message.reply')
    @Roles(Role.ALL)
    addReplyMessage(@Payload() dto: ReplyMessageDto) {
        try {
            return this.messageService.addReplyMessage(dto);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при создании ответа на сообщение');
        }
    }

    @Put('/delete-for-self')
    @ApiOperation({summary: 'Позволяет удалить сообщение только для себя'})
    @ApiBody({type: IDeleteForSelfDto, description: 'Пример данных для удаления'})
    @ApiResponse({type: SuccessResponse, status: 200, description: 'Возвращает статус успешности процесса'})
    @Roles(Role.ALL)
    markAsDeleteForMe(@Body() dto: IDeleteForSelfDto) {
        try {
            return this.messageService.markAsDeleteForMe(dto.userUid, dto.message_uids);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при удалении собщения для себя');
        }
    }

    @Put('/pin-for-self/:message_uid')
    @ApiOperation({summary: 'Позволяет закрепить сообщение только для себя'})
    @ApiBody({type: SetPinForSelfMessageDto, description: 'Пример данных для закрепления'})
    @ApiParam({name: 'message_uid', description: 'uid сообщения'})
    @ApiResponse({ status: 200, description: 'Возвращает закрепленное сообщение'})
    @Roles(Role.ALL)
    pinMessageForSelf(@Req() req: Request, @Body() dto: SetPinForSelfMessageDto, @Param('message_uid') message_uid: string) {
        try{
            const user : ITokenData = req['sessionData'];
            return this.messageService.setPinMessageForSelf(message_uid, dto.value, dto.match_uid, user.userUid);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при закреплении сообщения для себя');
        }
    }

    @MessagePattern('message.pin')
    @Roles(Role.ALL)
    setPinMessage(@Payload() dto: SetPinMessageDto) {
        try {
            return this.messageService.setPinMessage(dto.message_uid, dto.value, dto.match_uid, dto.from_uid, dto.to_uid);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при создании ответа на сообщение');
        }
    }

    @Get('/dialog/:match_uid')
    @ApiOperation({summary: 'Позволяет получить сообщения диалога по его матчу'})
    @ApiResponse({status: 200, description: 'Возвращает все сообщения определенного матча'})
    @ApiQuery({name: 'skip', description: 'Указывает сколько сообщений пропустить'})
    @ApiQuery({name: 'take', description: 'Указывает сколько сообщений получить'})
    @ApiParam({name: 'match_uid', description: 'uid матча'})
    @Roles(Role.ALL)
    getMatchMessages(@Param() params: MatchUidDto, @Query('skip', new ParseIntPipe()) skip: number, @Query('take', new ParseIntPipe()) take: number , @Req() req: Request) {
        try {
            const user: ITokenData = req['sessionData'];
            return this.messageService.getMatchMessages(params.match_uid, {skip, take}, user.userUid);
        } catch (e) {
            this.logger.error(`Error in messageController:\n${e}`);
            throw new HttpException('Ошибка при получении сообщений по матчу', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
