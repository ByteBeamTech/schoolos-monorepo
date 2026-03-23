// @schoolos/document-engine
// Central document generation engine

export * from './generators/pdf';
export * from './generators/html';
export * from './helpers';
export * from './templates/invoice.template';
export * from './templates/certificate.template';
export * from './templates/hall-ticket.template';
export * from './templates/report-card.template';

export const TEMPLATE_TYPES = {
  INVOICE:     'invoice',
  RECEIPT:     'receipt',
  REPORT_CARD: 'report-card',
  CERTIFICATE: 'certificate',
  ID_CARD:     'id-card',
  PAYSLIP:     'payslip',
  HALL_TICKET: 'hall-ticket',
} as const;

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES];
