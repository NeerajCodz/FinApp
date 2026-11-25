import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Deletes Trash items older than each user's retention (Settings → Trash).
crons.daily('purge expired trash', { hourUTC: 3, minuteUTC: 15 }, internal.trash.purgeExpired, {});

export default crons;
