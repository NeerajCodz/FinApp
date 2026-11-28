/** Support tickets and reports: shared constants and validation (pure). */

export const TICKET_CATEGORIES = {
  account: 'Account and sign-in',
  bug: 'Something is broken',
  sync: 'Sync and devices',
  groups: 'Groups and splits',
  ai: 'FinAI and MCP',
  billing: 'Billing',
  privacy: 'Privacy and data',
  feedback: 'Feedback and ideas',
  other: 'Something else',
} as const;
export type TicketCategory = keyof typeof TICKET_CATEGORIES;

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const REPORT_REASONS = {
  spam: 'Spam or scam',
  harassment: 'Harassment or hate',
  impersonation: 'Impersonation',
  inappropriate: 'Inappropriate content',
  fraud: 'Fraud or suspicious payments',
  bug: 'Bug or broken feature',
  other: 'Something else',
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const SUPPORT_LIMITS = {
  subjectMax: 140,
  messageMax: 5000,
  reportMax: 2000,
  /** Open tickets one user may have at once. */
  openTicketsPerUser: 10,
  /** Reports one user may file per day. */
  reportsPerDay: 20,
} as const;

export function isTicketCategory(value: unknown): value is TicketCategory {
  return typeof value === 'string' && Object.hasOwn(TICKET_CATEGORIES, value);
}

export function isTicketPriority(value: unknown): value is TicketPriority {
  return typeof value === 'string' && (TICKET_PRIORITIES as readonly string[]).includes(value);
}

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && Object.hasOwn(REPORT_REASONS, value);
}

export function cleanText(value: string, max: number): string | null {
  const text = value.replace(/\r\n/g, '\n').trim();
  return text && text.length <= max ? text : null;
}

/** Status after a new message: a user reply reopens, a staff reply waits on the user. */
export function statusAfterMessage(current: TicketStatus, author: 'user' | 'staff'): TicketStatus {
  if (author === 'user') return current === 'closed' ? 'closed' : 'open';
  return current === 'closed' || current === 'resolved' ? current : 'pending';
}
