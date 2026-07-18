import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue }   from '@nestjs/bull';
import { Queue }         from 'bull';
import { PrismaService } from '@infra/database/prisma.service';
import { QUEUE_NAMES }   from '../../../infra/queue/queue.module';
import { CreateTicketDto, UpdateTicketDto, AddMessageDto } from '../dto/support.dto';
import { RealtimeGateway } from '../../../core/realtime/realtime.gateway';

// SLA response + resolution times in minutes
const SLA_POLICY: Record<string, { responseMin: number; resolutionMin: number }> = {
  CRITICAL: { responseMin:  60,   resolutionMin:  240  },  // 1h response, 4h resolve
  HIGH:     { responseMin:  240,  resolutionMin:  480  },  // 4h response, 8h resolve
  MEDIUM:   { responseMin:  480,  resolutionMin:  1440 },  // 8h response, 24h resolve
  LOW:      { responseMin:  1440, resolutionMin:  4320 },  // 24h response, 72h resolve
};

// Superadmin email for SLA breach alerts — configurable via env
const SUPPORT_ALERT_EMAIL = process.env.SUPPORT_ALERT_EMAIL ?? 'support@schoolos.com';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notifQueue: Queue,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async generateTicketNumber(tenantId: string): Promise<string> {
    const year  = new Date().getFullYear();
    const count = await this.prisma.supportTicket.count({ where: { tenantId } });
    return `TKT-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private computeSLADates(priority: string, from: Date = new Date()) {
    const policy = SLA_POLICY[priority] ?? SLA_POLICY.MEDIUM;
    return {
      slaResponseDueAt:   new Date(from.getTime() + policy.responseMin   * 60000),
      slaResolutionDueAt: new Date(from.getTime() + policy.resolutionMin * 60000),
    };
  }

  private async notifySchool(
    tenantId:     string,
    templateId:   string,
    data:         Record<string, string>,
    contactEmail: string,
  ) {
    try {
      await this.notifQueue.add('send', {
        tenantId,
        channel:    'EMAIL',
        to:         contactEmail,
        templateId,
        data,
      }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    } catch (err) {
      this.logger.error(`Failed to queue notification: ${err}`);
    }
  }

  private async notifyInternalAlert(templateId: string, data: Record<string, string>) {
    try {
      await this.notifQueue.add('send', {
        tenantId:   'SYSTEM',
        channel:    'EMAIL',
        to:         SUPPORT_ALERT_EMAIL,
        templateId,
        data,
      }, { attempts: 2 });
    } catch (err) {
      this.logger.error(`Failed to queue internal alert: ${err}`);
    }
  }

  // ── Create ticket ─────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateTicketDto, createdBy: string) {
    const ticketNumber = await this.generateTicketNumber(tenantId);
    const priority     = dto.priority ?? 'MEDIUM';
    const slaDates     = this.computeSLADates(priority);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId,
        title:               dto.title,
        description:         dto.description,
        category:            (dto.category ?? 'OTHER') as any,
        priority:            priority as any,
        status:              'OPEN',
        ticketNumber,
        createdBy,
        slaResponseDueAt:    slaDates.slaResponseDueAt,
        slaResolutionDueAt:  slaDates.slaResolutionDueAt,
      },
      include: {
        messages: true,
        tenant:   { select: { name: true, slug: true, contactEmail: true } },
      },
    });

    // Email confirmation to school
    await this.notifySchool(
      tenantId,
      'SUPPORT_TICKET_CREATED',
      {
        ticketNumber,
        title:        dto.title,
        priority,
        schoolName:   ticket.tenant.name,
        contactEmail: ticket.tenant.contactEmail,
      },
      ticket.tenant.contactEmail,
    );

    this.logger.log(`Ticket created: ${ticketNumber} [${priority}] | tenant:${tenantId} | SLA response by ${slaDates.slaResponseDueAt.toISOString()}`);

    // REALTIME: notify connected superadmins immediately instead of them
    // finding out on the next poll tick.
    this.realtime.emitToAdmins('support:new-ticket', {
      id:         ticket.id,
      ticketNumber,
      title:      dto.title,
      priority,
      schoolName: ticket.tenant.name,
    });

    return ticket;
  }

  // ── List by tenant ────────────────────────────────────────────────────────
  async listByTenant(tenantId: string, status?: string) {
    return this.prisma.supportTicket.findMany({
      where:   { tenantId, ...(status && { status: status as any }) },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ── Superadmin list all ───────────────────────────────────────────────────
  async listAll(filters: {
    status?: string; priority?: string; tenantId?: string;
    assignedTo?: string; slaBreached?: boolean;
  } = {}) {
    const where: any = {};
    if (filters.status)     where.status     = filters.status;
    if (filters.priority)   where.priority   = filters.priority;
    if (filters.tenantId)   where.tenantId   = filters.tenantId;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.slaBreached) {
      where.OR = [
        { slaResponseBreached:  true },
        { slaResolutionBreached: true },
      ];
    }

    return this.prisma.supportTicket.findMany({
      where,
      include: {
        tenant:   { select: { name: true, slug: true, contactEmail: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [
        { slaResolutionBreached: 'desc' },
        { slaResponseBreached:   'desc' },
        { priority:              'desc' },
        { updatedAt:             'desc' },
      ],
      take: 200,
    });
  }

  // ── Get single ticket ─────────────────────────────────────────────────────
  async getById(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const ticket = await this.prisma.supportTicket.findFirst({
      where,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        tenant:   { select: { name: true, slug: true, contactEmail: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  // ── Update ticket ─────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateTicketDto, _actorId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where:   { id },
      include: { tenant: { select: { name: true, contactEmail: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const data: any = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'RESOLVED') {
        data.resolvedAt = new Date();
        // Notify school on resolution
        await this.notifySchool(
          ticket.tenantId,
          'SUPPORT_TICKET_RESOLVED',
          {
            ticketNumber: ticket.ticketNumber,
            title:        ticket.title,
            schoolName:   ticket.tenant.name,
          },
          ticket.tenant.contactEmail,
        );
      }
    }
    if (dto.priority) {
      data.priority = dto.priority;
      // Recompute SLA dates if priority changed and ticket not resolved
      if (!['RESOLVED','CLOSED'].includes(ticket.status)) {
        const slaDates = this.computeSLADates(dto.priority, ticket.createdAt);
        data.slaResponseDueAt   = slaDates.slaResponseDueAt;
        data.slaResolutionDueAt = slaDates.slaResolutionDueAt;
        // Reset breach flags when priority is manually changed
        data.slaResponseBreached  = false;
        data.slaResolutionBreached = false;
      }
    }
    if (dto.assignedTo) data.assignedTo = dto.assignedTo;

    return this.prisma.supportTicket.update({ where: { id }, data });
  }

  // ── Add message ───────────────────────────────────────────────────────────
  async addMessage(
    id:         string,
    dto:        AddMessageDto,
    senderId:   string,
    senderRole: string,
    tenantId?:  string,
  ) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const ticket = await this.prisma.supportTicket.findFirst({
      where,
      include: { tenant: { select: { name: true, contactEmail: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId:   id,
        senderId,
        senderRole,
        message:    dto.message,
        isInternal: dto.isInternal ?? false,
      },
    });

    const ticketUpdate: any = { updatedAt: new Date() };

    if (senderRole === 'SUPER_ADMIN') {
      // First superadmin reply — record for SLA tracking
      if (!ticket.firstResponseAt) {
        ticketUpdate.firstResponseAt = new Date();
      }
      // Auto-status: move to WAITING_CUSTOMER when superadmin replies
      if (ticket.status === 'IN_PROGRESS' || ticket.status === 'OPEN') {
        ticketUpdate.status = 'WAITING_CUSTOMER';
      }
      // Notify school of reply (skip internal notes)
      if (!dto.isInternal) {
        await this.notifySchool(
          ticket.tenantId,
          'SUPPORT_TICKET_REPLIED',
          {
            ticketNumber: ticket.ticketNumber,
            title:        ticket.title,
            message:      dto.message.substring(0, 300),
            schoolName:   ticket.tenant.name,
          },
          ticket.tenant.contactEmail,
        );
      }
    } else {
      // School replied — move back to IN_PROGRESS
      if (ticket.status === 'WAITING_CUSTOMER') {
        ticketUpdate.status = 'IN_PROGRESS';
      }
    }

    await this.prisma.supportTicket.update({ where: { id }, data: ticketUpdate });

    // REALTIME: notify whichever side didn't just send the message.
    const messagePayload = {
      ticketId:     id,
      ticketNumber: ticket.ticketNumber,
      message:      dto.message.substring(0, 200),
      senderRole,
    };
    if (senderRole === 'SUPER_ADMIN') {
      if (!dto.isInternal) this.realtime.emitToTenant(ticket.tenantId, 'support:new-message', messagePayload);
    } else {
      this.realtime.emitToAdmins('support:new-message', messagePayload);
    }

    return message;
  }

  // ── SLA Check (called by cron) ────────────────────────────────────────────
  async runSLACheck() {
    const now    = new Date();
    let breaches = 0;
    let escalations = 0;

    // Find open/in-progress tickets with overdue SLA
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        status: { notIn: ['RESOLVED', 'CLOSED'] as any[] },
      },
      include: { tenant: { select: { name: true, contactEmail: true } } },
    });

    for (const ticket of tickets) {
      const updates: any = {};

      // ── Response SLA breach ──────────────────────────────────────────
      if (
        ticket.slaResponseDueAt &&
        now > ticket.slaResponseDueAt &&
        !ticket.firstResponseAt &&
        !ticket.slaResponseBreached
      ) {
        updates.slaResponseBreached = true;
        breaches++;

        const hoursOverdue = Math.round(
          (now.getTime() - ticket.slaResponseDueAt.getTime()) / 3600000
        );

        await this.notifyInternalAlert('SUPPORT_SLA_BREACH_INTERNAL', {
          ticketNumber: ticket.ticketNumber,
          title:        ticket.title,
          priority:     ticket.priority,
          schoolName:   ticket.tenant.name,
          breachType:   'RESPONSE',
          hoursOverdue: String(hoursOverdue),
        });

        this.logger.warn(
          `SLA RESPONSE BREACH: ${ticket.ticketNumber} [${ticket.priority}] | ${hoursOverdue}h overdue`
        );
      }

      // ── Resolution SLA breach ────────────────────────────────────────
      if (
        ticket.slaResolutionDueAt &&
        now > ticket.slaResolutionDueAt &&
        !ticket.slaResolutionBreached
      ) {
        updates.slaResolutionBreached = true;
        breaches++;

        const hoursOverdue = Math.round(
          (now.getTime() - ticket.slaResolutionDueAt.getTime()) / 3600000
        );

        await this.notifyInternalAlert('SUPPORT_SLA_BREACH_INTERNAL', {
          ticketNumber: ticket.ticketNumber,
          title:        ticket.title,
          priority:     ticket.priority,
          schoolName:   ticket.tenant.name,
          breachType:   'RESOLUTION',
          hoursOverdue: String(hoursOverdue),
        });
      }

      // ── Auto-escalation ──────────────────────────────────────────────
      // Escalate if resolution SLA breached and not yet escalated today
      if (
        updates.slaResolutionBreached &&
        ticket.escalationLevel < 2
      ) {
        const newLevel    = ticket.escalationLevel + 1;
        const newPriority = newLevel >= 2 ? 'CRITICAL' : (
          ticket.priority === 'LOW' ? 'MEDIUM' :
          ticket.priority === 'MEDIUM' ? 'HIGH' : 'CRITICAL'
        );

        updates.escalationLevel  = newLevel;
        updates.lastEscalatedAt  = now;
        updates.priority         = newPriority as any;

        // Recompute SLA from now with new priority
        const slaDates = this.computeSLADates(newPriority, now);
        updates.slaResponseDueAt   = slaDates.slaResponseDueAt;
        updates.slaResolutionDueAt = slaDates.slaResolutionDueAt;
        updates.slaResponseBreached  = false;
        updates.slaResolutionBreached = false;

        escalations++;

        await this.notifyInternalAlert('SUPPORT_ESCALATION', {
          ticketNumber:    ticket.ticketNumber,
          title:           ticket.title,
          priority:        newPriority,
          schoolName:      ticket.tenant.name,
          escalationLevel: String(newLevel),
        });

        this.logger.warn(
          `AUTO-ESCALATION: ${ticket.ticketNumber} → Level ${newLevel} [${newPriority}]`
        );
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: updates });
      }
    }

    this.logger.log(`SLA check: ${tickets.length} tickets | ${breaches} breaches | ${escalations} escalations`);
    return { checked: tickets.length, breaches, escalations };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async stats() {
    const [open, inProgress, resolved, critical, slaBreached, closed] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN', priority: 'CRITICAL' } }),
      this.prisma.supportTicket.count({
        where: {
          status: { notIn: ['RESOLVED', 'CLOSED'] as any[] },
          OR: [{ slaResponseBreached: true }, { slaResolutionBreached: true }],
        },
      }),
      this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
    ]);
    return {
      open, inProgress, resolved, critical, slaBreached, closed,
      total: open + inProgress + resolved + closed,
    };
  }

  async reopen(id: string, tenantId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where:   { id, tenantId },
      include: { tenant: { select: { name: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Idempotent — if already open, return as-is
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) return ticket;

    const sla = this.computeSLADates(ticket.priority, new Date());

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status:               'IN_PROGRESS',
        resolvedAt:           null,
        slaResponseDueAt:     sla.slaResponseDueAt,
        slaResolutionDueAt:   sla.slaResolutionDueAt,
        slaResponseBreached:  false,
        slaResolutionBreached: false,
      },
    });
  }

}



