# Prisma Logical Client Groups

## Problem
With 18 schema files, a single PrismaClient import is large.
In serverless/edge functions this causes cold start delays.

## Solution
Split into logical client groups. Each group only loads the schemas it needs.

## Groups

| Client | Schemas | Used by |
|--------|---------|---------|
| CoreClient | tenant, user, session, audit, feature-flag | auth, roles, compliance |
| AcademicClient | academics, attendance, examinations, gradebook | academic modules |
| BillingClient | student-billing, saas-billing | billing modules |
| AdminClient | staff, payroll, inventory, accounting | admin modules |
| FullClient | all schemas | main backend API server |

## Usage

Main backend (NestJS) always uses FullClient via PrismaService.
Edge functions and serverless use specific logical clients only.

## Implementation

When implementing, use Prisma extension pattern:
  prisma.$extends({ ... }) to create scoped clients
Do NOT create separate Prisma instances — they each maintain a connection pool.
