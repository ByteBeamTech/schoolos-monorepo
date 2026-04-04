import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateAnnouncementDto, CreateCircularDto } from '../dto/communication.dto';

@Injectable()
export class CommunicationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Announcements ──────────────────────────────────────────────────────────
  async listAnnouncements(tenantId: string) {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        tenantId,
        OR: [
          { publishedAt: null },
          { publishedAt: { lte: now } },
        ],
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAnnouncement(tenantId: string, dto: CreateAnnouncementDto, actorId: string) {
    return this.prisma.announcement.create({
      data: {
        tenantId,
        title:       dto.title,
        body:        dto.body,
        isPinned:    dto.isPinned    ?? false,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        expiresAt:   dto.expiresAt   ? new Date(dto.expiresAt)   : null,
        targetRoles: dto.targetRoles ? JSON.stringify(dto.targetRoles) : undefined,
        createdBy:   actorId,
      },
    });
  }

  async pinAnnouncement(tenantId: string, id: string) {
    const a = await this.prisma.announcement.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Announcement not found');
    return this.prisma.announcement.update({ where: { id }, data: { isPinned: !a.isPinned } });
  }

  async deleteAnnouncement(tenantId: string, id: string) {
    const a = await this.prisma.announcement.findFirst({ where: { id, tenantId } });
    if (!a) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Circulars ──────────────────────────────────────────────────────────────
  async listCirculars(tenantId: string) {
    return this.prisma.circular.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCircular(tenantId: string, dto: CreateCircularDto, actorId: string) {
    return this.prisma.circular.create({
      data: {
        tenantId,
        title:       dto.title,
        body:        dto.body,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        targetRoles: dto.targetRoles  ? JSON.stringify(dto.targetRoles)  : undefined,
        attachments: dto.attachments  ? JSON.stringify(dto.attachments)  : undefined,
        createdBy:   actorId,
      },
    });
  }

  async stats(tenantId: string) {
    const [announcements, pinned, circulars] = await Promise.all([
      this.prisma.announcement.count({ where: { tenantId } }),
      this.prisma.announcement.count({ where: { tenantId, isPinned: true } }),
      this.prisma.circular.count({ where: { tenantId } }),
    ]);
    return { announcements, pinned, circulars };
  }
}
