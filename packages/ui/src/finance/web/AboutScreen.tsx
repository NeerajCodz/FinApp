'use client';

import React from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bug,
  Check,
  CircleCheck,
  CloudOff,
  Copy,
  Github,
  Heart,
  Loader2,
  RefreshCw,
  ScrollText,
  Shield,
  Sparkles,
  Tag,
} from 'lucide-react';
import styles from './AboutScreen.module.css';
import {
  DEVELOPER_URL,
  ISSUES_URL,
  OPEN_SOURCE_CREDITS,
  RELEASES_URL,
  SOURCE_URL,
  diagnosticsText,
  releaseUrl,
  type ReleaseNotes,
  type UpdateState,
  type VersionRow,
} from '../../version/model';

export type AboutScreenProps = {
  /** The brand mark (coin logo) rendered in the hero. */
  logo: React.ReactNode;
  productVersion: string;
  channel: string;
  rows: readonly VersionRow[];
  notes?: ReleaseNotes;
  update: UpdateState;
  /** Reload (web) to pick up a newer deploy. */
  onUpdate?: () => void;
  onBack?: () => void;
  /** In-app privacy policy route. */
  onOpenPrivacy?: () => void;
};

function UpdateBadge({ update, onUpdate }: { update: UpdateState; onUpdate?: () => void }) {
  if (update.kind === 'checking')
    return (
      <span className={styles.status}>
        <Loader2 size={14} className={styles.spin} aria-hidden /> Checking for updates…
      </span>
    );
  if (update.kind === 'offline')
    return (
      <span className={styles.status}>
        <CloudOff size={14} aria-hidden /> Offline — can’t check for updates
      </span>
    );
  if (update.kind === 'current')
    return (
      <span className={styles.status} data-tone="positive">
        <CircleCheck size={14} aria-hidden /> You’re on the latest version
      </span>
    );
  return (
    <span className={styles.updateRow}>
      <span className={styles.status} data-tone={update.kind === 'required' ? 'warning' : 'accent'}>
        <Sparkles size={14} aria-hidden />
        {update.kind === 'required'
          ? `Update required — ${update.latest} is live`
          : `Finapp ${update.latest} is available`}
      </span>
      {onUpdate ? (
        <button type="button" className={styles.primary} onClick={onUpdate}>
          <RefreshCw size={14} aria-hidden /> Update now
        </button>
      ) : null}
    </span>
  );
}

function LinkRow({
  icon,
  title,
  description,
  href,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <span className={styles.linkIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.linkText}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ArrowUpRight size={16} className={styles.linkArrow} aria-hidden />
    </>
  );
  return href ? (
    <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <button type="button" className={styles.link} onClick={onPress}>
      {content}
    </button>
  );
}

export function AboutScreen({
  logo,
  productVersion,
  channel,
  rows,
  notes,
  update,
  onUpdate,
  onBack,
  onOpenPrivacy,
}: AboutScreenProps) {
  const [copied, setCopied] = React.useState<'idle' | 'copied' | 'failed'>('idle');
  const diagnostics = diagnosticsText(rows);
  React.useEffect(() => {
    if (copied === 'idle') return;
    const timer = setTimeout(() => setCopied('idle'), 2200);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {onBack ? (
          <button type="button" className={styles.iconButton} aria-label="Go back" onClick={onBack}>
            <ArrowLeft size={19} aria-hidden />
          </button>
        ) : null}
        <h1>About</h1>
      </header>

      <section className={styles.hero} aria-labelledby="about-title">
        <div className={styles.logo}>{logo}</div>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Personal finance &amp; bill splitting</p>
          <h2 id="about-title">Finapp</h2>
          <div className={styles.pills}>
            <span className={styles.pill} data-strong>
              <Tag size={13} aria-hidden /> v{productVersion}
            </span>
            <span className={styles.pill}>{channel}</span>
          </div>
          <UpdateBadge update={update} onUpdate={onUpdate} />
        </div>
      </section>

      <div className={styles.grid}>
        {notes ? (
          <section className={styles.card} aria-labelledby="about-new">
            <div className={styles.cardHead}>
              <h3 id="about-new">
                <Sparkles size={16} aria-hidden /> What’s new in {notes.version}
              </h3>
              <a
                className={styles.textLink}
                href={releaseUrl(notes.version)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Release notes <ArrowUpRight size={13} aria-hidden />
              </a>
            </div>
            <p className={styles.summary}>{notes.summary}</p>
            <ul className={styles.highlights}>
              {notes.highlights.map((item) => (
                <li key={item.title}>
                  <span className={styles.bullet} aria-hidden>
                    <Check size={12} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.card} aria-labelledby="about-versions">
          <div className={styles.cardHead}>
            <h3 id="about-versions">
              <ScrollText size={16} aria-hidden /> Version &amp; build
            </h3>
          </div>
          <table className={styles.table}>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.diagnostics}>
            <button type="button" className={styles.secondary} onClick={() => void copy()}>
              {copied === 'copied' ? (
                <Check size={15} aria-hidden />
              ) : (
                <Copy size={15} aria-hidden />
              )}
              {copied === 'copied' ? 'Copied' : 'Copy diagnostics'}
            </button>
            <span className={styles.hint} role="status" aria-live="polite">
              {copied === 'failed'
                ? 'Copy failed — select the details above instead.'
                : 'Paste these details when you report a problem.'}
            </span>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="about-links">
          <div className={styles.cardHead}>
            <h3 id="about-links">Help &amp; links</h3>
          </div>
          <div className={styles.links}>
            {onOpenPrivacy ? (
              <LinkRow
                icon={<Shield size={17} />}
                title="Privacy policy"
                description="What Finapp stores and why."
                onPress={onOpenPrivacy}
              />
            ) : null}
            <LinkRow
              icon={<Tag size={17} />}
              title="All releases"
              description="Changelogs and downloads on GitHub."
              href={RELEASES_URL}
            />
            <LinkRow
              icon={<Bug size={17} />}
              title="Report a problem"
              description="Open an issue — include your diagnostics."
              href={ISSUES_URL}
            />
            <LinkRow
              icon={<Github size={17} />}
              title="Source code"
              description="Finapp on GitHub."
              href={SOURCE_URL}
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="about-credits">
          <div className={styles.cardHead}>
            <h3 id="about-credits">Built with open source</h3>
          </div>
          <ul className={styles.credits}>
            {OPEN_SOURCE_CREDITS.map((credit) => (
              <li key={credit.name}>
                <a href={credit.url} target="_blank" rel="noopener noreferrer">
                  {credit.name}
                </a>
                <span>{credit.license}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className={styles.footer}>
        <span>
          Made with <Heart size={14} aria-label="love" className={styles.heart} /> by{' '}
          <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer">
            Neeraj
          </a>
        </span>
      </footer>
    </div>
  );
}
