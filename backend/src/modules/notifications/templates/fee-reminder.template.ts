import { baseTemplate } from './base.template';

interface FeeReminderTemplateData {
  studentName: string;
  amount: number;
  dueDate: string;
  schoolName?: string;
}

export function feeReminderTemplate(
  data: FeeReminderTemplateData,
): string {
  return baseTemplate(`
    <h2
      style="
        margin-top: 0;
        color: #0f172a;
      "
    >
      Fee Payment Reminder
    </h2>

    <p
      style="
        color: #334155;
        line-height: 1.7;
        font-size: 15px;
      "
    >
      Dear Parent,
    </p>

    <p
      style="
        color: #334155;
        line-height: 1.7;
        font-size: 15px;
      "
    >
      This is a reminder that the fee payment
      for
      <strong>${data.studentName}</strong>
      is pending.
    </p>

    <div
      style="
        margin: 24px 0;
        padding: 20px;
        background: #f8fafc;
        border-radius: 8px;
      "
    >
      <p
        style="
          margin: 8px 0;
          font-size: 15px;
        "
      >
        <strong>Amount:</strong>
        ₹${data.amount}
      </p>

      <p
        style="
          margin: 8px 0;
          font-size: 15px;
        "
      >
        <strong>Due Date:</strong>
        ${data.dueDate}
      </p>
    </div>

    <p
      style="
        color: #334155;
        line-height: 1.7;
        font-size: 15px;
      "
    >
      Kindly complete the payment before
      the due date to avoid penalties.
    </p>

    <p
      style="
        margin-top: 32px;
        color: #64748b;
        font-size: 14px;
      "
    >
      Regards,<br />
      ${
        data.schoolName ||
        'SchoolOS'
      }
    </p>
  `);
}
