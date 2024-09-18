import { IsNotEmpty, IsString } from 'class-validator';

export class ParamMessageUidDto {
    @IsString()
    @IsNotEmpty()
    readonly message_uid: string;
}
