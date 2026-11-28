import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Deletes Trash items older than each user's retention (Settings → Trash).
crons.daily('purge expired trash', { hourUTC: 3, minuteUTC: 15 }, internal.trash.purgeExpired, {});

// Deletes FinAI attachment files past their retention (Settings → FinAI, default 24 hours).
crons.hourly(
  'purge expired FinAI attachments',
  { minuteUTC: 7 },
  internal.ai.attachments.purgeExpired,
  {},
);

// Remove unreferenced storage files only after issued upload URLs have expired.
crons.daily(
  'purge unreferenced storage',
  { hourUTC: 4, minuteUTC: 15 },
  internal.ai.receipts.purgeOrphanedStorage,
  {},
);

export default crons;
