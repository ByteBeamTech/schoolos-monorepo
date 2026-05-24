// /apps/schoolos/backend/src/modules/bulk/dto/bulk-student.contracts.ts

export enum BulkImportErrorType {
  VALIDATION_ERROR = 'ERR_ROW_MALFORMED',
  HIERARCHY_VIOLATION = 'ERR_HIERARCHY_MISMATCH',
  DATABASE_WRITE_VIOLATION = 'ERR_DATABASE_COMMIT_FAIL',
}

export enum BulkInvoiceErrorType {
  TIMEOUT = 'ERR_EXECUTION_TIMEOUT',
  DEADLOCK = 'ERR_TRANSACTION_DEADLOCK',
  BUSINESS_ERROR = 'ERR_BILLING_VIOLATION',
}

export type BulkImportStatus = 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';

export interface BulkStudentRow {
  readonly firstName: string;
  readonly lastName?: string | null;
  readonly admissionNumber: string | number;
  readonly academicYear: string | number;
  readonly branchId: string;
  readonly classId: string | number;
  readonly sectionId?: string | null;
}

export interface ValidatedStudentData {
  readonly firstName: string;
  readonly lastName: string | null;
  readonly admissionNumber: string;
  readonly academicYear: string;
  readonly branchId: string;
  readonly classId: string;
  readonly sectionId: string | null;
}

export interface BulkImportError {
  readonly row: number;
  readonly code: BulkImportErrorType;
  readonly message: string;
  readonly correlationId: string;
}

export interface BulkInvoiceError {
  readonly studentId: string;
  readonly code: BulkInvoiceErrorType;
  readonly message: string;
  readonly correlationId: string;
}

/**
 * 📊 GOVERNED SYSTEMS TELEMETRY MATRIX CONTRACT (GAP CLOSED)
 */
export interface BulkTelemetrySnapshot {
  readonly correlationId: string;
  readonly tenantId: string;
  readonly operation: 'STUDENT_BULK_IMPORT' | 'CLASS_INVOICE_BULK';
  readonly status: BulkImportStatus; // 🟢 FIX #3: Injected execution result state classification
  readonly executionTimeMs: number;
  readonly throughputPerSecond: number; // 🟢 FIX #7: Automated metric performance tracking
  readonly performanceMetrics: {
    readonly totalRecords: number;
    readonly successfulCommits: number;
    readonly failuresCount: number;
    readonly eventLoopYields: number;
    readonly overflowCount: number;
  };
  // 🟢 FIX #6: Hardened mapping types to enforce error keys domain definitions
  readonly errorDistribution: Partial<Record<BulkImportErrorType, number>>; 
}

export type AdvisoryLockResult = {
  readonly acquired: boolean;
};

export type IndexVerificationResult = {
  readonly indexname: string;
};

export class TimeoutError extends Error {
  constructor(message: string = 'Execution burst timed out during transaction block.') {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
