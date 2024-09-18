import { IsNotEmpty, IsString } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';
import { PickType } from '@nestjs/mapped-types';

export class MarkReadMessageDto extends PickType(CreateMessageDto, ['match_uid']) {
    @IsString()
    @IsNotEmpty()
    readonly message_uid: string;
}
