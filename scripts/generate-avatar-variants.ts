import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { format, resolveConfig } from 'prettier';

const sourceDirectory = resolve(import.meta.dir, '../assets/images/avatar');
const outputDirectory = resolve(import.meta.dir, '../assets/avatar');
const avatarIds = Array.from({ length: 101 }, (_, index) => `AV${index}`);

const variants = {
  high: { size: 384, quality: 86 },
  medium: { size: 192, quality: 82 },
  low: { size: 96, quality: 76 },
} as const;

async function render(input: Buffer, size: number, quality: number) {
  return sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer();
}

for (const variant of Object.keys(variants) as (keyof typeof variants)[]) {
  await mkdir(join(outputDirectory, variant), { recursive: true });
}

let totalBytes = 0;
for (const avatarId of avatarIds) {
  const sourcePath = join(sourceDirectory, `${avatarId}.png`);
  const source = await sharp(sourcePath).png().toBuffer();
  const high = await render(source, variants.high.size, variants.high.quality);
  const medium = await render(high, variants.medium.size, variants.medium.quality);
  const low = await render(high, variants.low.size, variants.low.quality);

  for (const [variant, image] of Object.entries({ high, medium, low })) {
    const outputPath = join(outputDirectory, variant, `${avatarId}.webp`);
    await writeFile(outputPath, image);
    totalBytes += (await stat(outputPath)).size;
  }
}

const generated = await readdir(join(outputDirectory, 'high'));
if (generated.length !== avatarIds.length) {
  throw new Error(
    `Expected ${avatarIds.length} high-resolution avatars, found ${generated.length}`,
  );
}

const tierNames = Object.keys(variants) as (keyof typeof variants)[];
const nativeEntries = avatarIds
  .map(
    (avatarId) =>
      `  ${avatarId}: { ${tierNames
        .map((tier) => `${tier}: require('../../../assets/avatar/${tier}/${avatarId}.webp')`)
        .join(', ')} },`,
  )
  .join('\n');
const webImports = avatarIds
  .flatMap((avatarId) =>
    tierNames.map(
      (tier) =>
        `import ${avatarId}${tier[0].toUpperCase()}${tier.slice(1)} from '../../../assets/avatar/${tier}/${avatarId}.webp';`,
    ),
  )
  .join('\n');
const webEntries = avatarIds
  .map(
    (avatarId) =>
      `  ${avatarId}: { ${tierNames
        .map((tier) => `${tier}: ${avatarId}${tier[0].toUpperCase()}${tier.slice(1)}.src`)
        .join(', ')} },`,
  )
  .join('\n');
const resolver = `
const avatarAssets = {
${nativeEntries}
} as const;

export function resolveAvatarAsset(avatarId: string | undefined, size: number) {
  if (!avatarId) return undefined;
  const assets = avatarAssets[avatarId as keyof typeof avatarAssets];
  if (!assets) return undefined;
  const tier = size > 64 ? 'high' : size > 32 ? 'medium' : 'low';
  return assets[tier];
}
`;
const nativePath = resolve(import.meta.dir, '../packages/ui/src/avatar-assets.native.ts');
const nativeOptions = (await resolveConfig(nativePath)) ?? {};
await writeFile(nativePath, await format(resolver, { ...nativeOptions, filepath: nativePath }));
const webPath = resolve(import.meta.dir, '../packages/ui/src/avatar-assets.web.ts');

const webSource = `/// <reference path="./webp.d.ts" />
${webImports}

const avatarAssets = {
${webEntries}
} as const;

export function resolveAvatarAsset(avatarId: string | undefined, size: number) {
  if (!avatarId) return undefined;
  const assets = avatarAssets[avatarId as keyof typeof avatarAssets];
  if (!assets) return undefined;
  const tier = size > 64 ? 'high' : size > 32 ? 'medium' : 'low';
  return assets[tier];
}
`;
const webOptions = (await resolveConfig(webPath)) ?? {};
await writeFile(webPath, await format(webSource, { ...webOptions, filepath: webPath }));

console.log(`Generated ${avatarIds.length * 3} WebP variants (${totalBytes} bytes total).`);
console.log('High: 384px, medium: 192px, low: 96px; medium and low derive from high.');
