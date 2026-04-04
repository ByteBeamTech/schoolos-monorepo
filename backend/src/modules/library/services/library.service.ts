import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateBookDto, IssueBookDto, ReturnBookDto } from '../dto/library.dto';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(tenantId: string) {
    const [books, issued, overdue] = await Promise.all([
      this.prisma.book.aggregate({ where: { tenantId }, _sum: { totalCopies: true, availableCopies: true }, _count: true }),
      this.prisma.bookIssue.count({ where: { tenantId, status: 'ISSUED' } }),
      this.prisma.bookIssue.count({ where: { tenantId, status: 'ISSUED', dueDate: { lt: new Date() } } }),
    ]);
    return {
      totalBooks:      books._count,
      totalCopies:     books._sum.totalCopies     ?? 0,
      availableCopies: books._sum.availableCopies ?? 0,
      issued,
      overdue,
    };
  }

  async listBooks(tenantId: string, search?: string) {
    const books = await this.prisma.book.findMany({
      where:   { tenantId },
      include: { _count: { select: { issues: true } } },
      orderBy: { title: 'asc' },
    });
    if (!search) return books;
    const s = search.toLowerCase();
    return books.filter((b: any) =>
      b.title.toLowerCase().includes(s) ||
      (b.author    ?? '').toLowerCase().includes(s) ||
      (b.isbn      ?? '').includes(s) ||
      (b.subject   ?? '').toLowerCase().includes(s)
    );
  }

  async createBook(tenantId: string, dto: CreateBookDto) {
    return this.prisma.book.create({
      data: { tenantId, ...dto, availableCopies: dto.totalCopies },
    });
  }

  async issueBook(tenantId: string, dto: IssueBookDto, actorId: string) {
    const book = await this.prisma.book.findFirst({ where: { id: dto.bookId, tenantId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.availableCopies < 1) throw new BadRequestException('No copies available');

    const active = await this.prisma.bookIssue.findFirst({
      where: { tenantId, studentId: dto.studentId, status: 'ISSUED' },
    });
    if (active) throw new BadRequestException('Student already has a book issued');

    const [issue] = await this.prisma.$transaction([
      this.prisma.bookIssue.create({
        data: {
          tenantId, bookId: dto.bookId, studentId: dto.studentId,
          dueDate: new Date(dto.dueDate), status: 'ISSUED', issuedBy: actorId,
        },
        include: {
          book: { select: { title: true, isbn: true } },
        },
      }),
      this.prisma.book.update({ where: { id: dto.bookId }, data: { availableCopies: { decrement: 1 } } }),
    ]);
    return issue;
  }

  async returnBook(tenantId: string, issueId: string, dto: ReturnBookDto) {
    const issue = await this.prisma.bookIssue.findFirst({ where: { id: issueId, tenantId } });
    if (!issue)                   throw new NotFoundException('Issue not found');
    if (issue.status === 'RETURNED') throw new BadRequestException('Already returned');

    const isOverdue = new Date() > new Date(issue.dueDate);
    await this.prisma.$transaction([
      this.prisma.bookIssue.update({
        where: { id: issueId },
        data:  { status: 'RETURNED' as any, returnedAt: new Date(), fine: dto.fine ?? null },
      }),
      this.prisma.book.update({
        where: { id: issue.bookId },
        data:  { availableCopies: { increment: 1 } },
      }),
    ]);
    return { returned: true, wasOverdue: isOverdue, fine: dto.fine ?? 0 };
  }

  async overdueList(tenantId: string) {
    return this.prisma.bookIssue.findMany({
      where:   { tenantId, status: 'ISSUED', dueDate: { lt: new Date() } },
      include: {
        book: { select: { title: true, isbn: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async studentHistory(tenantId: string, studentId: string) {
    return this.prisma.bookIssue.findMany({
      where:   { tenantId, studentId },
      include: { book: { select: { title: true, author: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async listIssues(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.prisma.bookIssue.findMany({
      where,
      include: {
        book: { select: { title: true, isbn: true, author: true } },
        // Note: BookIssue has no ORM relation to Student; use studentId for lookup
      },
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
  }

}
