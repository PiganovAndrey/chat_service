import { IsNumber } from 'class-validator';

export class FilterOptionsDto {
    @IsNumber()
    readonly skip: number = 0;
    @IsNumber()
    readonly take: number = 15;
}
