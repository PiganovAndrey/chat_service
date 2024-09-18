import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class IDeleteForSelfDto {
    @IsString()
    @IsNotEmpty()
    readonly userUid: string;
    @IsArray()
    @IsString({ each: true })
    @ArrayNotEmpty()
    readonly message_uids: string[];
}
