'use client';

import React from 'react';
import styles from './FinanceEmptyState.module.css';

export type FinanceEmptyKind =
  | 'account'
  | 'budget'
  | 'transaction'
  | 'analytics'
  | 'goal'
  | 'category'
  | 'activity'
  | 'group'
  | 'recurring'
  | 'search'
  | 'contribution'
  | 'invitation';

export type FinanceEmptyStateProps = {
  kind: FinanceEmptyKind;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
};

function Illustration({ kind, compact }: { kind: FinanceEmptyKind; compact: boolean }) {
  const accent = 'var(--finapp-primary)';
  const muted = 'var(--finapp-foreground-muted)';
  const border = 'var(--finapp-border)';
  const surface = 'var(--finapp-surface-raised)';

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={styles.illustration}
      data-compact={compact || undefined}
      viewBox="0 0 192 132"
    >
      <circle cx="96" cy="66" r="56" fill={surface} />
      {kind === 'account' && (
        <>
          <rect
            x="43"
            y="39"
            width="106"
            height="64"
            rx="10"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <path d="M43 54h106v16H43z" fill={accent} opacity=".9" />
          <rect
            x="109"
            y="76"
            width="27"
            height="17"
            rx="5"
            fill={surface}
            stroke={border}
            strokeWidth="1.5"
          />
          <circle cx="117" cy="84.5" r="2" fill={accent} />
          <path d="M57 84h37m-37 9h24" stroke={muted} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === 'budget' && (
        <>
          <rect
            x="49"
            y="35"
            width="94"
            height="68"
            rx="9"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <path
            d="M67 55h58M67 68h58M67 81h58"
            stroke={border}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M67 55h34M67 68h45M67 81h20"
            stroke={accent}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="132" cy="91" r="10" fill={accent} />
          <path
            d="M132 86v10m-3-7h5a2 2 0 0 1 0 4h-5"
            fill="none"
            stroke="var(--finapp-background)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'transaction' && (
        <>
          <path
            d="M61 35h70v70l-9-6-9 6-9-6-9 6-9-6-9 6-9-6-7 6z"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M75 52h41m-41 13h25m-25 13h34"
            stroke={muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="120" cy="84" r="9" fill={accent} />
          <path
            d="M117 84h6m-3-3v6"
            stroke="var(--finapp-background)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'analytics' && (
        <>
          <path d="M49 99h94" stroke={border} strokeWidth="2" strokeLinecap="round" />
          <rect x="59" y="75" width="15" height="24" rx="3" fill={muted} opacity=".55" />
          <rect x="82" y="59" width="15" height="40" rx="3" fill={accent} opacity=".55" />
          <rect x="105" y="44" width="15" height="55" rx="3" fill={accent} />
          <path
            d="m60 66 24-15 19 5 25-21"
            fill="none"
            stroke="var(--finapp-foreground)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="128" cy="35" r="5" fill={accent} />
        </>
      )}
      {kind === 'goal' && (
        <>
          <circle
            cx="88"
            cy="66"
            r="36"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <circle cx="88" cy="66" r="25" fill="none" stroke={muted} strokeWidth="2" />
          <circle cx="88" cy="66" r="13" fill="none" stroke={accent} strokeWidth="3" />
          <circle cx="88" cy="66" r="4" fill={accent} />
          <path
            d="m91 63 37-31m-13-2 15-2-2 15"
            fill="none"
            stroke="var(--finapp-foreground)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'category' && (
        <>
          <rect
            x="47"
            y="39"
            width="43"
            height="38"
            rx="8"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <rect
            x="101"
            y="39"
            width="43"
            height="38"
            rx="8"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <rect x="47" y="88" width="43" height="21" rx="7" fill={accent} opacity=".8" />
          <rect
            x="101"
            y="88"
            width="43"
            height="21"
            rx="7"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <circle cx="68" cy="58" r="10" fill={accent} />
          <path d="M118 49v18m-9-9h18" stroke={muted} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === 'activity' && (
        <>
          <path d="M47 100h98" stroke={border} strokeWidth="2" strokeLinecap="round" />
          <path
            d="m53 86 23-19 17 11 30-33 16 11"
            fill="none"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="76" cy="67" r="4" fill={accent} />
          <circle cx="123" cy="45" r="5" fill={accent} />
          <path
            d="M57 47v-8m0 8 7-2m61 45h16"
            stroke={muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'group' && (
        <>
          <circle cx="96" cy="49" r="13" fill={accent} />
          <circle cx="65" cy="60" r="10" fill={muted} />
          <circle cx="127" cy="60" r="10" fill={muted} />
          <path
            d="M72 99c1-17 10-25 24-25s23 8 24 25m-67 0c1-14 7-21 17-22m56 22c-1-14-7-21-17-22"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M77 94c4 3 9 5 19 5s15-2 19-5"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'recurring' && (
        <>
          <path
            d="M63 58a33 33 0 0 1 57-12l8 9m0 0-1-16m1 16-16-1M129 75a33 33 0 0 1-57 12l-8-9m0 0 1 16m-1-16 16 1"
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="96"
            cy="66"
            r="18"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <path
            d="M96 55v12l8 5"
            fill="none"
            stroke="var(--finapp-foreground)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === 'search' && (
        <>
          <rect
            x="49"
            y="38"
            width="76"
            height="60"
            rx="8"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <path
            d="M64 53h41M64 65h30M64 77h23"
            stroke={muted}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="119" cy="78" r="14" fill={surface} stroke={accent} strokeWidth="3" />
          <path d="m129 88 10 10" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {kind === 'contribution' && (
        <>
          <path d="M54 96h86" stroke={border} strokeWidth="2" strokeLinecap="round" />
          <rect x="62" y="75" width="20" height="21" rx="4" fill={muted} opacity=".5" />
          <rect x="88" y="61" width="20" height="35" rx="4" fill={accent} opacity=".65" />
          <rect x="114" y="46" width="20" height="50" rx="4" fill={accent} />
          <circle cx="64" cy="45" r="11" fill={accent} />
          <path
            d="M64 39v12m-4-8h7a2 2 0 0 1 0 4h-7"
            fill="none"
            stroke="var(--finapp-background)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'invitation' && (
        <>
          <rect
            x="43"
            y="44"
            width="106"
            height="62"
            rx="9"
            fill="var(--finapp-card)"
            stroke={border}
            strokeWidth="2"
          />
          <path
            d="m46 51 50 37 50-37"
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="132" cy="38" r="13" fill={accent} />
          <path
            d="m127 38 4 4 7-8"
            fill="none"
            stroke="var(--finapp-background)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function FinanceEmptyState({
  kind,
  title,
  description,
  action,
  compact = false,
}: FinanceEmptyStateProps) {
  return (
    <section className={`${styles.emptyState} ${compact ? styles.compact : ''}`}>
      <Illustration kind={kind} compact={compact} />
      <div className={styles.copy}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
