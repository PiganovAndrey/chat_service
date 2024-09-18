import { PickType } from '@nestjs/mapped-types';
import { SetPinMessageDto } from './setPinMessageDto';

export class SetPinForSelfMessageDto extends PickType(SetPinMessageDto, ['match_uid', 'value']) {}
