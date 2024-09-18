import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
    @IsNotEmpty()
    readonly match_uid: string;
    @IsNotEmpty()
    readonly from_uid: string;
    @IsNotEmpty()
    readonly to_uid: string;
    @IsBoolean()
    @IsOptional()
    readonly is_user1_favorite?: boolean;
    @IsBoolean()
    @IsOptional()
    readonly is_user2_favorite?: boolean;
    @IsString()
    @IsNotEmpty()
    readonly content: string;
    @IsNotEmpty()
    @IsDateString()
    @Transform(({ value }) => new Date(value).toISOString(), { toClassOnly: true })
    readonly sent_time: string;
}
