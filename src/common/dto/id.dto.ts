import { IsMongoId, IsNotEmpty } from 'class-validator';

export class QueryIdDto {
    @IsMongoId()
    @IsNotEmpty()
    readonly id: string;
}
