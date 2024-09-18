import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDialogDto {
    @IsNotEmpty()
    @IsString()
    readonly user1: string;
    @IsNotEmpty()
    @IsString()
    readonly user2: string;
    @IsNotEmpty()
    @IsString()
    readonly match_uid: string;
}
