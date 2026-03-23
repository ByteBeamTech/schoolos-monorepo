export interface TemplateData {
  [key: string]: string | number | undefined;
}

export interface RenderedTemplate {
  subject: string;
  body:    string;
  smsBody: string;
}

export const TEMPLATES = {

  ABSENT_ALERT: (data: {
    studentName:  string;
    date:         string;
    schoolName?:  string;
    contactPhone?: string;
  }): RenderedTemplate => ({
    subject: `Attendance Alert — ${data.studentName} was absent today`,
    body: `Dear Parent,\n\nThis is to inform you that ${data.studentName} was marked ABSENT on ${data.date}.\n\nIf this is an error or if you have already informed the school, please ignore this message.\n\nFor queries, contact: ${data.contactPhone ?? 'the school office'}.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Alert: ${data.studentName} was ABSENT on ${data.date}. Contact school for details.`,
  }),

  LATE_ALERT: (data: {
    studentName: string;
    date:        string;
    schoolName?: string;
  }): RenderedTemplate => ({
    subject: `Late Arrival — ${data.studentName}`,
    body: `Dear Parent,\n\n${data.studentName} arrived LATE to school on ${data.date}.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `${data.studentName} arrived LATE on ${data.date}.`,
  }),

  INVOICE_GENERATED: (data: {
    studentName:   string;
    invoiceNumber: string;
    amount:        string;
    dueDate:       string;
    schoolName?:   string;
  }): RenderedTemplate => ({
    subject: `Fee Invoice ${data.invoiceNumber} — ${data.studentName}`,
    body: `Dear Parent,\n\nA fee invoice has been generated for ${data.studentName}.\n\nInvoice: ${data.invoiceNumber}\nAmount:  ${data.amount}\nDue By:  ${data.dueDate}\n\nPlease make the payment before the due date to avoid late fees.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Invoice ${data.invoiceNumber} for ${data.studentName}: ${data.amount} due by ${data.dueDate}.`,
  }),

  PAYMENT_RECEIVED: (data: {
    studentName:   string;
    amount:        string;
    receiptNumber: string;
    schoolName?:   string;
  }): RenderedTemplate => ({
    subject: `Payment Received — ${data.receiptNumber}`,
    body: `Dear Parent,\n\nWe have received your payment of ${data.amount} for ${data.studentName}.\n\nReceipt No: ${data.receiptNumber}\n\nThank you for the timely payment.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Payment of ${data.amount} received for ${data.studentName}. Receipt: ${data.receiptNumber}.`,
  }),

  PAYMENT_OVERDUE: (data: {
    studentName:   string;
    invoiceNumber: string;
    amount:        string;
    dueDate:       string;
    daysOverdue:   string;
    schoolName?:   string;
  }): RenderedTemplate => ({
    subject: `Overdue Payment — ${data.invoiceNumber}`,
    body: `Dear Parent,\n\nThis is a reminder that the fee payment for ${data.studentName} is OVERDUE by ${data.daysOverdue} days.\n\nInvoice: ${data.invoiceNumber}\nAmount:  ${data.amount}\nDue By:  ${data.dueDate}\n\nPlease make the payment immediately to avoid further penalties.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `OVERDUE: Fee of ${data.amount} for ${data.studentName} was due on ${data.dueDate}. Pay immediately.`,
  }),

  FEE_REMINDER: (data: {
    studentName:   string;
    invoiceNumber: string;
    amount:        string;
    dueDate:       string;
    daysLeft:      string;
    schoolName?:   string;
  }): RenderedTemplate => ({
    subject: `Fee Payment Reminder — Due in ${data.daysLeft} days`,
    body: `Dear Parent,\n\nThis is a reminder that the fee payment for ${data.studentName} is due in ${data.daysLeft} days.\n\nInvoice: ${data.invoiceNumber}\nAmount:  ${data.amount}\nDue By:  ${data.dueDate}\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Reminder: Fee of ${data.amount} for ${data.studentName} due in ${data.daysLeft} days (${data.dueDate}).`,
  }),

  LEAVE_APPROVED: (data: {
    studentName: string;
    fromDate:    string;
    toDate:      string;
    schoolName?: string;
  }): RenderedTemplate => ({
    subject: `Leave Approved — ${data.studentName}`,
    body: `Dear Parent,\n\nThe leave request for ${data.studentName} from ${data.fromDate} to ${data.toDate} has been APPROVED.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Leave for ${data.studentName} (${data.fromDate} to ${data.toDate}) has been APPROVED.`,
  }),

  LEAVE_REJECTED: (data: {
    studentName: string;
    fromDate:    string;
    toDate:      string;
    schoolName?: string;
  }): RenderedTemplate => ({
    subject: `Leave Rejected — ${data.studentName}`,
    body: `Dear Parent,\n\nThe leave request for ${data.studentName} from ${data.fromDate} to ${data.toDate} has been REJECTED.\n\nPlease contact the school for more information.\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Leave for ${data.studentName} (${data.fromDate} to ${data.toDate}) has been REJECTED.`,
  }),

  WELCOME: (data: {
    name:        string;
    schoolName?: string;
    loginUrl?:   string;
  }): RenderedTemplate => ({
    subject: `Welcome to ${data.schoolName ?? 'SchoolOS'}`,
    body: `Dear ${data.name},\n\nWelcome to ${data.schoolName ?? 'SchoolOS'}!\n\nYou can access the parent portal at: ${data.loginUrl ?? 'https://app.schoolos.com'}\n\nRegards,\n${data.schoolName ?? 'School Administration'}`,
    smsBody: `Welcome to ${data.schoolName ?? 'SchoolOS'}, ${data.name}! Access portal at ${data.loginUrl ?? 'app.schoolos.com'}`,
  }),


  // ── Support Ticket Templates ──────────────────────────────────────────────

  SUPPORT_TICKET_CREATED: (data: {
    ticketNumber: string;
    title:        string;
    priority:     string;
    schoolName:   string;
    contactEmail: string;
  }): RenderedTemplate => ({
    subject: `[${data.ticketNumber}] New Support Ticket — ${data.title}`,
    body: `Hi ${data.schoolName} team,\n\nYour support ticket has been received.\n\nTicket: ${data.ticketNumber}\nSubject: ${data.title}\nPriority: ${data.priority}\n\nOur team will respond within the SLA window for ${data.priority} priority tickets.\n\nYou can track your ticket status in the SchoolOS dashboard under Support.\n\nRegards,\nSchoolOS Support Team`,
    smsBody: `SchoolOS: Ticket ${data.ticketNumber} created. Priority: ${data.priority}. We'll respond shortly.`,
  }),

  SUPPORT_TICKET_REPLIED: (data: {
    ticketNumber: string;
    title:        string;
    message:      string;
    schoolName:   string;
  }): RenderedTemplate => ({
    subject: `[${data.ticketNumber}] Reply from SchoolOS Support`,
    body: `Hi ${data.schoolName} team,\n\nSchoolOS Support has replied to your ticket.\n\nTicket: ${data.ticketNumber}\nSubject: ${data.title}\n\nMessage:\n${data.message}\n\nPlease log in to your SchoolOS dashboard to continue the conversation.\n\nRegards,\nSchoolOS Support Team`,
    smsBody: `SchoolOS: New reply on ticket ${data.ticketNumber}. Login to view.`,
  }),

  SUPPORT_TICKET_RESOLVED: (data: {
    ticketNumber: string;
    title:        string;
    schoolName:   string;
  }): RenderedTemplate => ({
    subject: `[${data.ticketNumber}] Ticket Resolved`,
    body: `Hi ${data.schoolName} team,\n\nYour support ticket has been marked as resolved.\n\nTicket: ${data.ticketNumber}\nSubject: ${data.title}\n\nIf you feel the issue is not fully resolved, please reply to reopen the ticket.\n\nThank you for contacting SchoolOS Support.\n\nRegards,\nSchoolOS Support Team`,
    smsBody: `SchoolOS: Ticket ${data.ticketNumber} resolved. Reply to reopen if needed.`,
  }),

  SUPPORT_SLA_BREACH_INTERNAL: (data: {
    ticketNumber: string;
    title:        string;
    priority:     string;
    schoolName:   string;
    breachType:   string;
    hoursOverdue: string;
  }): RenderedTemplate => ({
    subject: `🚨 SLA BREACH [${data.breachType}] — ${data.ticketNumber} (${data.priority})`,
    body: `SLA BREACH ALERT\n\nTicket: ${data.ticketNumber}\nSchool: ${data.schoolName}\nSubject: ${data.title}\nPriority: ${data.priority}\nBreach Type: ${data.breachType}\nHours Overdue: ${data.hoursOverdue}\n\nThis ticket requires immediate attention.\n\nLog in to the SchoolOS superadmin panel to action this ticket.`,
    smsBody: `SLA BREACH: Ticket ${data.ticketNumber} (${data.priority}) overdue by ${data.hoursOverdue}h. Action required.`,
  }),

  SUPPORT_ESCALATION: (data: {
    ticketNumber:   string;
    title:          string;
    priority:       string;
    schoolName:     string;
    escalationLevel: string;
  }): RenderedTemplate => ({
    subject: `⚠️ ESCALATED to Level ${data.escalationLevel} — ${data.ticketNumber}`,
    body: `TICKET ESCALATED\n\nTicket: ${data.ticketNumber}\nSchool: ${data.schoolName}\nSubject: ${data.title}\nNew Priority: ${data.priority}\nEscalation Level: ${data.escalationLevel}\n\nThis ticket has been auto-escalated due to SLA breach.`,
    smsBody: `ESCALATED: Ticket ${data.ticketNumber} now CRITICAL. Immediate action required.`,
  }),

  CUSTOM: (data: { body: string; subject?: string }): RenderedTemplate => ({
    subject: data.subject ?? 'Message from School',
    body:    data.body,
    smsBody: data.body.substring(0, 160),
  }),
};

export function renderTemplate(
  templateId: string,
  data:       Record<string, any>,
): RenderedTemplate {
  const fn = (TEMPLATES as any)[templateId];
  if (!fn) {
    return TEMPLATES.CUSTOM({ body: data.body ?? '', subject: data.subject });
  }
  return fn(data);
}
