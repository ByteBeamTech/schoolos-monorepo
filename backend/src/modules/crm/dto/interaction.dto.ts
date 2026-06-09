import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const INTERACTION_TYPE_VALUES = ['CALL', 'WHATSAPP', 'EMAIL', 'SMS', 'MEETING'] as const;
export type InteractionTypeValue = (typeof INTERACTION_TYPE_VALUES)[number];

export const INTERACTION_DIRECTION_VALUES = ['INBOUND', 'OUTBOUND'] as const;
export type InteractionDirectionValue = (typeof INTERACTION_DIRECTION_VALUES)[number];

export class CreateInteractionDto {
  @IsEnum(INTERACTION_TYPE_VALUES as unknown as string[])
  type!: InteractionTypeValue;

  @IsEnum(INTERACTION_DIRECTION_VALUES as unknown as string[])
  direction!: InteractionDirectionValue;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  summary!: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
