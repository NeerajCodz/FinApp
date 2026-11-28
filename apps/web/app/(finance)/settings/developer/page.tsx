import { DeveloperSettingsClient } from './DeveloperSettingsClient';

/** Settings → API & developer. The docs link uses NEXT_PUBLIC_DOCS_URL (the docs site) when set. */
export default function DeveloperSettingsPage() {
  const docsSite = process.env.NEXT_PUBLIC_DOCS_URL?.trim().replace(/\/$/, '');
  const docsUrl = docsSite
    ? `${docsSite}/developers/overview`
    : 'https://github.com/NeerajCodz/FinApp/blob/main/apps/docs/content/developers/overview.md';
  return <DeveloperSettingsClient docsUrl={docsUrl} />;
}
