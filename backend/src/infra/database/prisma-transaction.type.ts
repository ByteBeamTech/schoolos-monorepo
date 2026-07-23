import type { PrismaService } from './prisma.service';

/**
 * The client handed to callbacks inside `prisma.$transaction(...)`:
 * structurally a PrismaService minus the connection and transaction-control
 * methods, which an interactive transaction client does not expose.
 *
 * Lives here because it now has more than one consumer. It was originally
 * declared inside DiscountCategoryProvisioningService with a note to move it
 * to a shared location once a second service needed it; AuditService is that
 * second service.
 *
 * Prefer this over `tx: any` for any service method that accepts a caller's
 * transaction: `any` silently accepts a plain PrismaService, which is exactly
 * the mistake worth catching (a "transactional" write that quietly opens its
 * own connection and commits independently).
 */
export type PrismaTransactionClient = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
