export type AuditEvent = {
  actorId: string;
  entityType: string;
  entityId: string;
  operation: string;
  beforeHash?: string;
  afterHash?: string;
  occurredAt: number;
};

export function hashSnapshot(value: unknown): string {
  const serialized = JSON.stringify(value, (_, item) =>
    typeof item === 'bigint' ? `${item}n` : item,
  );
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1)
    hash = Math.imul(hash ^ serialized.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function writeAuditEvent(
  db: { insert: (table: 'auditEvents', value: AuditEvent) => Promise<string> },
  event: Omit<AuditEvent, 'occurredAt'>,
): Promise<string> {
  return db.insert('auditEvents', { ...event, occurredAt: Date.now() });
}
