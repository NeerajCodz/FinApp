import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');
const avatarIds = Array.from({ length: 101 }, (_, index) => `AV${index}`);
const genderFor = (avatarId: string) =>
  avatarId === 'AV0' ? 'neutral' : Number(avatarId.slice(2)) <= 50 ? 'male' : 'female';

type CatalogEntry = { avatarId: string; gender: 'neutral' | 'male' | 'female'; url: string };
type UploadTarget = { avatarId: string; uploadUrl: string };
type UploadedEntry = { avatarId: string; storageId: string };

async function runConvex<T>(functionName: string, args: Record<string, unknown>): Promise<T> {
  const child = Bun.spawn(['bunx', 'convex', 'run', functionName, JSON.stringify(args), '--prod'], {
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Convex call ${functionName} failed: ${stderr.trim() || stdout.trim()}`);
  }
  try {
    return JSON.parse(stdout.trim()) as T;
  } catch {
    throw new Error(`Convex call ${functionName} returned invalid JSON.`);
  }
}

async function uploadOne(target: UploadTarget): Promise<UploadedEntry> {
  const path = resolve(projectRoot, 'assets', 'images', 'avatar', `${target.avatarId}.png`);
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Missing avatar asset ${target.avatarId}.png`);
  const response = await fetch(target.uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: file,
  });
  if (!response.ok)
    throw new Error(`Upload failed for ${target.avatarId}: HTTP ${response.status}`);
  const result = (await response.json()) as { storageId?: string };
  if (!result.storageId) throw new Error(`Upload returned no storage ID for ${target.avatarId}`);
  return { avatarId: target.avatarId, storageId: result.storageId };
}

async function main() {
  const existing = await runConvex<CatalogEntry[]>('avatars/queries:list', {});
  const existingById = new Map(existing.map((entry) => [entry.avatarId, entry]));
  const missing = avatarIds.filter((avatarId) => !existingById.has(avatarId));
  if (missing.length === 0) {
    console.log('Avatar catalog already contains all 101 entries; no uploads needed.');
    return;
  }

  const targets = await runConvex<UploadTarget[]>('avatars/mutations:generateUploadUrls', {
    avatarIds: missing,
  });
  if (targets.length !== missing.length)
    throw new Error('Convex returned an incomplete upload plan.');

  let uploadedCount = 0;
  for (let offset = 0; offset < targets.length; offset += 5) {
    const batch = await Promise.all(targets.slice(offset, offset + 5).map(uploadOne));
    const result = await runConvex<{ upserted: number }>('avatars/mutations:upsertCatalog', {
      entries: batch,
    });
    if (result.upserted !== batch.length)
      throw new Error('Convex saved an incomplete avatar batch.');
    uploadedCount += batch.length;
    console.log(`Saved ${uploadedCount}/${missing.length} missing avatars.`);
  }

  const catalog = await runConvex<CatalogEntry[]>('avatars/queries:list', {});
  const catalogById = new Map(catalog.map((entry) => [entry.avatarId, entry]));
  const invalid = avatarIds.filter((avatarId) => {
    const entry = catalogById.get(avatarId);
    return !entry || entry.gender !== genderFor(avatarId) || !entry.url.startsWith('https://');
  });
  if (invalid.length)
    throw new Error(`Avatar catalog verification failed for ${invalid.join(', ')}.`);
  console.log(
    `Verified ${catalog.length} public avatar URLs: AV0 neutral, AV1–50 male, AV51–100 female.`,
  );
}

await main();
