import { PickType } from '@nestjs/mapped-types';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';

export class UpdateMessageDto extends PickType(CreateMessageDto, ['content'] as const) {
    @IsOptional()
    @IsMongoId()
    readonly id?: string;
    @IsOptional()
    @IsString()
    readonly message_uid?: string;
}
