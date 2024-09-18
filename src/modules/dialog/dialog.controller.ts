import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    Req,
    LoggerService,
    HttpStatus,
    HttpException,
    Query,
    Inject,
    OnModuleInit
} from '@nestjs/common';
import { DialogService } from './dialog.service';
import ITokenData from 'src/common/interfaces/token.data';
import { CreateDialogDto } from './dto/create-dialog.dto';
import { MatchUidDto } from 'src/common/dto/matchUid.dto';
import { QueryIdDto } from 'src/common/dto/id.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Request } from 'express';
import { Role } from 'src/common/enums/roles.enum';
import { ClientKafka, KafkaRetriableException, MessagePattern, Payload } from '@nestjs/microservices';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserDialogResponse } from './response/user-dialog.response';
import { DialogResponse } from './response/dialog.response';
import { CheckMatchDialogResponse } from './response/check-match-dialog.response';
import { SuccessResponse } from 'src/common/interfaces/success.response';

@ApiTags('dialog')
@Controller('dialog')
export class DialogController implements OnModuleInit {
    constructor(
        private readonly dialogService: DialogService,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
        @Inject('MATCH_SERVICE') private readonly clientMatch: ClientKafka,
        @Inject('IMAGE_SERVICE') private readonly clientImage: ClientKafka,
        @Inject('USER_MOBILE_SERVICE') private readonly clientUser: ClientKafka,
    ) {}

    async onModuleInit() {
        this.clientMatch.subscribeToResponseOf('match.get');
        this.clientMatch.subscribeToResponseOf('match.dialog');
        this.clientImage.subscribeToResponseOf('image.user.get');
        this.clientUser.subscribeToResponseOf('user.get')

        await this.clientMatch.connect();
        await this.clientImage.connect();
        await this.clientUser.connect();
    }

    @Get('/user_uid')
    @Roles(Role.ALL)
    @ApiOperation({summary: 'Позволяет получить диалоги пользователя по его сессии'})
    @ApiResponse({status: 200, description: 'Возвращает диалоги пользователя', type: UserDialogResponse})
    getUserDialogs(@Req() req: Request) {
        try {
            const user: ITokenData = req['sessionData'];
            return this.dialogService.getUserDialogs(user.userUid);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new HttpException('Ошибка при получении все диалогов пользователя', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    @Get('/:match_uid')
    @Roles(Role.ALL)
    @ApiOperation({summary: 'Позволяет получить диалог по его матчу'})
    @ApiParam({name: 'match_uid', description: 'uid матча'})
    @ApiResponse({status: 200, description: 'Возвращает диалог пользователя по матчу', type: DialogResponse})
    getDialogByMatchUid(@Param() params: MatchUidDto, @Req() req: Request) {
        try {
            const user: ITokenData = req['sessionData'];
            return this.dialogService.getDialogByMatchUid(params.match_uid, user.userUid);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new HttpException('Ошибка при получении диалога по match_uid', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    @Get('/')
    @Roles(Role.ADMIN)
    @ApiOperation({summary: 'Позволяет получить все диалоги, метод для админов'})
    @ApiResponse({status: 200, description: 'Возвращает все диалоги из БД'})
    getAllDialogs() {
        try {
            return this.dialogService.getAllDialogs();
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new HttpException('Ошибка при получении всех диалогов', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    @Post('/')
    @ApiOperation({summary: 'Позволяет создать диалог'})
    @ApiBody({type: CreateDialogDto, description: 'Пример данных для создания'})
    @ApiResponse({status: 200, description: 'Возвращает созданный диалог'})
    @Roles(Role.ALL)
    createDialog(@Body() dto: CreateDialogDto) {
        try {
            return this.dialogService.createDialog(dto);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            this.logger.error(e);
            throw new HttpException('Ошибка при создании диалога', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @MessagePattern('dialog.create')
    @Roles(Role.ALL)
    kafkaCreateDialog(@Payload() dto: CreateDialogDto) {
        try{
            return this.dialogService.createDialog(dto);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при создании диалога');
        }
    }
    @Get('/check/:match_uid')
    @ApiOperation({summary: 'Позволяет проверить матч диалога, существует ли он'})
    @ApiParam({name: 'match_uid', description: 'uid матча'})
    @ApiResponse({status: 200, description: 'Возвращает id диалога и статус завершенности процесса', type: CheckMatchDialogResponse})
    @Roles(Role.ALL)
    checkMatchDialog(@Param() params: MatchUidDto) {
        try {
            return this.dialogService.checkMatchDialog(params.match_uid);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new HttpException('Ошибка при проверке матча диалога', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @MessagePattern('dialog.check')
    @Roles(Role.ALL)
    kafkaCheckMatchDialog(@Payload() dto: MatchUidDto) {
        try{
            return this.dialogService.checkMatchDialog(dto.match_uid);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при проверке диалога');
        }
    }

    @Delete('/:match_uid')
    @ApiOperation({summary: 'Позволяет удалить диалог по его матчу'})
    @ApiParam({name: 'match_uid', description: 'uid матча'})
    @ApiResponse({status: 200, description: "Возвращает статус об усешности процесса", type: SuccessResponse})
    @Roles(Role.ALL)
    deleteDialogByMatch(@Param() params: MatchUidDto) {
        try {
            return this.dialogService.deleteDialogByMatch(params.match_uid);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new HttpException('Ошибка при удалении диалога', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @MessagePattern('dialog.delete')
    @Roles(Role.ALL)
    kafkaDeleteDialogByMatch(@Payload() dto: MatchUidDto) {
        try{
            return this.dialogService.deleteDialogByMatch(dto.match_uid);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new KafkaRetriableException('Ошибка при удалении диалога');
        }
    }

    @Delete('/')
    @ApiOperation({summary: 'Позволяет удалить диалог по его id из БД'})
    @ApiQuery({name: 'id', description: 'id диалога'})
    @ApiResponse({status: 200, description: "Возвращает статус об усешности процесса", type: SuccessResponse})
    @Roles(Role.ADMIN)
    deleteDialogById(@Query() query: QueryIdDto) {
        try {
            return this.dialogService.deleteDialogById(query.id);
        } catch (e) {
            this.logger.error(`Error in dialogController:\n${e}`);
            throw new HttpException('Ошибка при удалении диалога', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
