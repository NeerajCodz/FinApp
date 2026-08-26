export const domainErrorCodes = [
  'AUTH_REQUIRED',
  'NOT_MEMBER',
  'INVALID_SPLIT',
  'TRANSACTION_CHANGED',
  'INSUFFICIENT_PERMISSION',
  'INVALID_CURRENCY',
  'DUPLICATE_MUTATION',
  'GROUP_ARCHIVED',
] as const;
export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function domainError(code: DomainErrorCode, message?: string): DomainError {
  return new DomainError(code, message ?? code);
}
