export type GroupMetadataDraft = {
  description: string;
  groupType: string;
  purpose: string;
  location: string;
  startDate: string;
  endDate: string;
};

export function dateInput(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toISOString().slice(0, 10)
    : '';
}

export function dateTimestamp(value: string): number {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00.000Z`) : NaN;
  if (!Number.isFinite(timestamp) || dateInput(timestamp) !== value)
    throw new Error('Choose a valid date.');
  return timestamp;
}

export function groupMetadataDraft(record?: Record<string, unknown> | null): GroupMetadataDraft {
  return {
    description: typeof record?.description === 'string' ? record.description : '',
    groupType: typeof record?.groupType === 'string' ? record.groupType : '',
    purpose: typeof record?.purpose === 'string' ? record.purpose : '',
    location: typeof record?.location === 'string' ? record.location : '',
    startDate: dateInput(record?.startAt),
    endDate: dateInput(record?.endAt),
  };
}

export function groupMetadataPayload(draft: GroupMetadataDraft) {
  const description = draft.description.trim();
  if (description.length > 200) throw new Error('Description must be 200 characters or fewer.');
  const startAt = draft.startDate ? dateTimestamp(draft.startDate) : undefined;
  const endAt = draft.endDate ? dateTimestamp(draft.endDate) : undefined;
  if (startAt !== undefined && endAt !== undefined && endAt < startAt)
    throw new Error('End date must be on or after the start date.');
  return {
    description,
    groupType: draft.groupType.trim(),
    purpose: draft.purpose.trim(),
    location: draft.location.trim(),
    ...(startAt === undefined ? {} : { startAt }),
    ...(endAt === undefined ? {} : { endAt }),
  };
}
