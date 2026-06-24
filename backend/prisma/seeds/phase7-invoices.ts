import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmqqjpii80003yy8zhr2gm9uu';

async function main() {
  console.log('\n💰 PHASE 7 INVOICES STARTED\n');

  const students = await prisma.student.findMany({
    include: {
      feeAssignments: {
        include: {
          feePlan: {
            include: {
              feeItems: true,
            },
          },
        },
      },
    },
    orderBy: {
      admissionNumber: 'asc',
    },
  });

  let invoiceCounter = 1;
  let receiptCounter = 1;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];

    const feeAssignment = student.feeAssignments?.[0];

    if (!feeAssignment) continue;

    const feeItems = feeAssignment.feePlan.feeItems;

    const subtotal = feeItems.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    const gstAmount = 0;
    const totalAmount = subtotal;
    const isPaid = i < 400;

    const invoice = await prisma.invoice.create({
      data: {
        tenantId: TENANT_ID,
        branchId: student.branchId,
        studentId: student.id,

        invoiceNumber: `INV-DEMO-${String(invoiceCounter).padStart(6, '0')}`,

        academicYear: '2026-27',

        status: isPaid ? 'PAID' : 'SENT',

        subtotal,
        discountAmount: 0,
        gstAmount,

        totalAmount,

        paidAmount: isPaid ? totalAmount : 0,
        dueAmount: isPaid ? 0 : totalAmount,

        issuedAt: new Date('2026-04-01'),
        dueDate: new Date('2026-04-15'),

        paidAt: isPaid ? new Date('2026-04-05') : null,

        notes: 'Demo Invoice Seed Data',
      },
    });

    for (let x = 0; x < feeItems.length; x++) {
      const feeItem = feeItems[x];

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          feeItemId: feeItem.id,

          name: feeItem.name,

          amount: feeItem.amount,
          discountAmount: 0,

          gstRate: feeItem.gstRate,
          gstAmount: 0,

          netAmount: feeItem.amount,

          sortOrder: x + 1,

          chargeCategory: 'ACADEMIC',
        },
      });
    }

    if (isPaid) {
      const payment = await prisma.payment.create({
        data: {
          tenantId: TENANT_ID,
          branchId: student.branchId,

          invoiceId: invoice.id,

          gateway: 'CASH',

          amount: totalAmount,

          status: 'SUCCESS',

          paymentMethod: 'CASH',

          payerName:
            `${student.firstName} ${student.lastName}`,

          payerPhone:
            student.phone ?? '9876543210',

          paidAt: new Date('2026-04-05'),
        },
      });

      await prisma.receipt.create({
        data: {
          tenantId: TENANT_ID,
          branchId: student.branchId,

          invoiceId: invoice.id,
          paymentId: payment.id,

          receiptNumber:
            `RCT-DEMO-${String(receiptCounter).padStart(6, '0')}`,

          amount: totalAmount,
        },
      });

      receiptCounter++;
    }

    invoiceCounter++;

    if (invoiceCounter % 50 === 0) {
      console.log(`Processed ${invoiceCounter} invoices`);
    }
  }

  console.log('\n================================');
  console.log(
    `Invoices : ${await prisma.invoice.count()}`
  );
  console.log(
    `Payments : ${await prisma.payment.count()}`
  );
  console.log(
    `Receipts : ${await prisma.receipt.count()}`
  );
  console.log('================================');

  console.log('\n✅ PHASE 7 COMPLETE\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
