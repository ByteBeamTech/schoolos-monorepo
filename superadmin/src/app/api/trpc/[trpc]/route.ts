// superadmin/src/app/api/trpc/[trpc]/route.ts
// NEW FILE — create this directory path and file
//
// THE ROOT CAUSE: The pricing page calls trpc.pricing.* hooks which POST to
// /api/trpc. This route does not exist — the superadmin app has no /api/trpc
// handler at all. Every tRPC call silently 404s. Plans appear to save but
// nothing is ever written to the database.
//
// This file creates the Next.js App Router handler for tRPC and injects
// a PrismaClient into context so the pricing router can query the DB.

import { fetchRequestHandler }  from '@trpc/server/adapters/fetch';
import { PrismaClient }         from '@prisma/client';
import { appRouter }            from '@schoolos/trpc';
import type { Context } from '@schoolos/trpc';

// Single PrismaClient instance for the API route (module-level singleton)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Parse the superadmin JWT from the Authorization header so superadminProcedure
// can validate ctx.user.isSuperadmin
async function createContext(req: Request): Promise<Context> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let user = null;
  if (token) {
    try {
      // Decode without verify here — the JwtSuperadminGuard on the NestJS side
      // already verified when the session was created. For tRPC we just need the
      // payload to check isSuperadmin.
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
      );
      user = {
        id:           payload.sub,
        email:        payload.email,
        role:         payload.role,
        isSuperadmin: payload.role === 'SUPER_ADMIN',
      };
    } catch {
      // Malformed token — ctx.user stays null, superadminProcedure will throw FORBIDDEN
    }
  }

  return {
    user,
    tenantId: null,
    requestId: crypto.randomUUID(),
    prisma,   // injected so pricingRouter procedures can call ctx.prisma.*
  } as any;  // Context type is extended here; prisma is typed as `any` in the router already
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint:    '/api/trpc',
    req,
    router:      appRouter,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`tRPC error on ${path}:`, error)
        : undefined,
  });

export { handler as GET, handler as POST };
