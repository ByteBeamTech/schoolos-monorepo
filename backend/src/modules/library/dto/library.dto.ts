import {
  IsString, IsInt, IsOptional, IsNotEmpty, IsDateString, IsArray, IsEnum, IsBoolean, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BorrowerType } from '@prisma/client';

/**
 * ADR-LIB-001 §3 -- Book is a catalog (title) record only; physical
 * copies are BookCopy, created separately (see CreateBookCopyDto /
 * addBookCopy). `authorName`/`publisherName`/`categoryName` are kept
 * as legacy-shaped convenience fields for the existing frontend form
 * (which still collects a single free-text author/subject/publisher)
 * -- LibraryService.createBook() resolves each to (or creates) the
 * matching Author/Publisher/BookCategory row rather than storing free
 * text, per §1's taxonomy. Prefer the *Id fields directly once a
 * proper picker UI exists (Phase 6).
 */
export class CreateBookDto {
  @ApiProperty()         @IsString() @IsNotEmpty() title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional()  isbn?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() categoryId?:  string;
  @ApiPropertyOptional() @IsString() @IsOptional() publisherId?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsArray() @IsOptional() @IsString({ each: true })
  authorIds?: string[];

  @ApiPropertyOptional({ description: 'Resolved-or-created by name if categoryId is not given.' })
  @IsString() @IsOptional() authorName?:    string;
  @ApiPropertyOptional({ description: 'Resolved-or-created by name if publisherId is not given.' })
  @IsString() @IsOptional() publisherName?: string;
  @ApiPropertyOptional({ description: 'Resolved-or-created by name if categoryId is not given.' })
  @IsString() @IsOptional() categoryName?:  string;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Convenience: also provision this many BookCopy rows at the acting user\u2019s current branch.',
  })
  @IsInt() @Min(0) @IsOptional() initialCopies?: number;
}

/** ADR-LIB-001 §3/§12 -- a physical item, always branch-scoped. */
export class CreateBookCopyDto {
  @ApiProperty() @IsString() @IsNotEmpty() bookId!: string;

  @ApiPropertyOptional({ description: 'Auto-generated via BarcodeSequence if omitted.' })
  @IsString() @IsOptional() barcode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() rfidTag?:   string;
  @ApiPropertyOptional() @IsString() @IsOptional() shelfId?:   string;
  @ApiPropertyOptional() @IsString() @IsOptional() condition?: string;
}

/**
 * ADR-LIB-001 §2 -- borrower is polymorphic (BorrowerType +
 * borrowerId), no LibraryMember. `copyId` issues that exact physical
 * item; alternatively give `bookId` and the acting user's current
 * branch (resolved server-side from the request's branch context,
 * same as every other branch-scoped write in this platform -- see
 * BranchContextMiddleware) is used to pick the oldest AVAILABLE copy.
 */
export class IssueBookDto {
  @ApiPropertyOptional() @IsString() @IsOptional() copyId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bookId?: string;

  @ApiProperty({ enum: BorrowerType }) @IsEnum(BorrowerType) borrowerType!: BorrowerType;
  @ApiProperty()                       @IsString() @IsNotEmpty() borrowerId!: string;

  @ApiPropertyOptional({ description: 'Defaults to LibraryBranchSettings.loanDurationDays from today if omitted.' })
  @IsDateString() @IsOptional() dueDate?: string;
}

export class ReturnBookDto {
  @ApiPropertyOptional({ default: false, description: 'Copy returned in a damaged condition.' })
  @IsBoolean() @IsOptional() damaged?: boolean;
}
