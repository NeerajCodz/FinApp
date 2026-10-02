import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');
const avatarIds = Array.from({ length: 101 }, (_, index) => `AV${index}`);
const genderFor = (avatarId: string) =>
  avatarId === 'AV0' ? 'neutral' : Number(avatarId.slice(2)) <= 50 ? 'male' : 'female';

type CatalogEntry = { avatarId: string; gender: string };
type CleanupResult = {
  catalogEntries: number;
  deletedObjects: number;
  preservedUserObjects: number;
  clearedEntries: number;
};

async function runConvex<T>(functionName: string): Promise<T> {
  const child = Bun.spawn(['bunx', 'convex', 'run', functionName, '{}', '--prod'], {
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    child.exited,
    new Response(child.stderr).text().then(() => undefined),
  ]);
  if (exitCode !== 0) throw new Error(`Convex production call failed: ${functionName}.`);
  try {
    return JSON.parse(stdout.trim()) as T;
  } catch {
    throw new Error(`Convex production call returned invalid JSON: ${functionName}.`);
  }
}

if (!process.env.CONVEX_DEPLOY_KEY) {
  throw new Error('CONVEX_DEPLOY_KEY must be set for production cleanup.');
}

const entries = await runConvex<CatalogEntry[]>('avatars/queries:list');
const byId = new Map(entries.map((entry) => [entry.avatarId, entry]));
const invalid =
  entries.length !== avatarIds.length ||
  avatarIds.some((avatarId) => byId.get(avatarId)?.gender !== genderFor(avatarId));
if (invalid)
  throw new Error('Production avatar catalog is incomplete or inconsistent; no cleanup ran.');

const result = await runConvex<CleanupResult>('avatars/mutations:removeCatalogStorage');
if (
  result.catalogEntries !== avatarIds.length ||
  result.deletedObjects < 0 ||
  result.deletedObjects > avatarIds.length ||
  result.preservedUserObjects < 0 ||
  result.preservedUserObjects > avatarIds.length ||
  result.clearedEntries < result.deletedObjects + result.preservedUserObjects ||
  result.clearedEntries > avatarIds.length
) {
  throw new Error('Production catalog cleanup returned an unexpected result.');
}

console.log(
  `Verified ${entries.length} catalog entries; removed ${result.deletedObjects} catalog storage objects, preserved ${result.preservedUserObjects} objects referenced by user profiles, and cleared ${result.clearedEntries} catalog references.`,
);
console.log(
  'All other user-uploaded profile photos and non-catalog storage objects were not targeted.',
);
