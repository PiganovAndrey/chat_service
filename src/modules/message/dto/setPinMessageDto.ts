import { PickType } from '@nestjs/mapped-types';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';

export class SetPinMessageDto extends PickType(CreateMessageDto, ['match_uid',]) {
    @IsNotEmpty()
    @IsBoolean()
    readonly value: boolean;
    @IsString()
    @IsNotEmpty()
    readonly message_uid: string;
    @IsString()
    @IsNotEmpty()
    readonly from_uid: string;
    @IsString()
    @IsNotEmpty()
    readonly to_uid: string;
}
