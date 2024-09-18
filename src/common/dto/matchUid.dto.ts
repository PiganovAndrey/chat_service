import { IsNotEmpty, IsString } from 'class-validator';

export class MatchUidDto {
    @IsString()
    @IsNotEmpty()
    readonly match_uid: string;
}
