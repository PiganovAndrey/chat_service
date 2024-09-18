import { IsNotEmpty, IsString } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';

export class ReplyMessageDto extends CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    readonly reply_message_uid: string;
}
