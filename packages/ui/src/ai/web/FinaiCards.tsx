'use client';

/**
 * FinAI card views for the web, drawn with theme tokens only. The A2UI catalog
 * (`FinaiSurface`) renders these for each component; they also render the parsed tree
 * directly if the A2UI processor rejects a payload.
 */
import React from 'react';
import { ArrowRight, CheckCircle, Sparkle, XCircle } from '@phosphor-icons/react';
import { ThinkingOrb } from '../../web/ThinkingOrb';
import {
  actionStatusLabel,
  finaiErrorMessage,
  type FinaiActionState,
  type FinaiNode,
  type FinaiTone,
} from '../finai';
import styles from './FinaiCards.module.css';

export type FinaiDecision = 'confirm' | 'cancel';

export type FinaiActionsContextValue = {
  actions: ReadonlyMap<string, FinaiActionState>;
  /** Action ids currently being confirmed or cancelled. */
  busy: ReadonlySet<string>;
  onDecide: (actionId: string, decision: FinaiDecision) => void;
};

export const FinaiActionsContext = React.createContext<FinaiActionsContextValue>({
  actions: new Map(),
  busy: new Set(),
  onDecide: () => {},
});

const toneClass = (tone: FinaiTone) => styles[`tone-${tone}`];

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <h4>{title}</h4>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

type Props<C extends FinaiNode['component']> = Omit<
  Extract<FinaiNode, { component: C }>,
  'id' | 'component'
>;

export function SummaryCardView({ title, subtitle, metrics }: Props<'SummaryCard'>) {
  return (
    <Card title={title} subtitle={subtitle}>
      <dl className={styles.metrics}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.metric}>
            <dt>{metric.label}</dt>
            <dd className={toneClass(metric.tone)}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function TransactionListView({ title, items, emptyText }: Props<'TransactionList'>) {
  return (
    <Card title={title}>
      {items.length ? (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <span className={styles.dot} data-tone={item.tone} aria-hidden />
              <span className={styles.itemText}>
                <strong>{item.title}</strong>
                {item.subtitle ? <small>{item.subtitle}</small> : null}
              </span>
              <span className={`${styles.amount} ${toneClass(item.tone)}`}>{item.amount}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{emptyText}</p>
      )}
    </Card>
  );
}

export function BarChartView({ title, bars }: Props<'BarChart'>) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <Card title={title}>
      <ul className={styles.bars} aria-label={title}>
        {bars.map((bar, index) => (
          <li key={`${bar.label}-${index}`}>
            <span className={styles.barLabel}>{bar.label}</span>
            <span className={styles.barTrack} aria-hidden>
              <span
                className={styles.barFill}
                style={{
                  width: `${Math.max(4, (bar.value / max) * 100)}%`,
                  animationDelay: `${index * 40}ms`,
                }}
              />
            </span>
            <span className={styles.barValue}>{bar.display}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProgressListView({ title, items }: Props<'ProgressList'>) {
  return (
    <Card title={title}>
      <ul className={styles.progress}>
        {items.map((item) => (
          <li key={item.label}>
            <div className={styles.progressRow}>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </div>
            <span
              className={styles.progressTrack}
              role="progressbar"
              aria-label={item.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
            >
              <span
                className={styles.progressFill}
                data-tone={item.tone}
                style={{ width: `${Math.round(item.progress * 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function BalanceListView({ title, subtitle, members, transfers }: Props<'BalanceList'>) {
  return (
    <Card title={title} subtitle={subtitle}>
      <ul className={styles.list}>
        {members.map((member) => (
          <li key={member.name}>
            <span className={styles.initial} data-tone={member.tone} aria-hidden>
              {member.name.slice(0, 1).toUpperCase()}
            </span>
            <span className={styles.itemText}>
              <strong>{member.name}</strong>
            </span>
            <span className={`${styles.amount} ${toneClass(member.tone)}`}>{member.amount}</span>
          </li>
        ))}
      </ul>
      {transfers.length ? (
        <div className={styles.transfers}>
          <span className={styles.caption}>Suggested transfers</span>
          {transfers.map((transfer, index) => (
            <div key={index} className={styles.transfer}>
              <span>{transfer.from}</span>
              <ArrowRight size={14} aria-label="pays" />
              <span>{transfer.to}</span>
              <strong>{transfer.amount}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function ActionCardView({
  actionId,
  title,
  lines,
  onConfirm,
  onCancel,
}: Props<'ActionCard'> & { onConfirm?: () => void; onCancel?: () => void }) {
  const { actions, busy, onDecide } = React.useContext(FinaiActionsContext);
  const state = actions.get(actionId);
  const status = state?.status ?? 'pending';
  const working = busy.has(actionId) || status === 'running';
  const decidable = !!state?.canDecide && status === 'pending' && !working;
  return (
    <section className={`${styles.card} ${styles.action}`} data-status={status}>
      <header className={styles.actionHeader}>
        <span className={styles.actionIcon} aria-hidden>
          {status === 'done' ? (
            <CheckCircle size={20} weight="fill" />
          ) : status === 'failed' || status === 'cancelled' || status === 'expired' ? (
            <XCircle size={20} weight="fill" />
          ) : (
            <Sparkle size={20} weight="fill" />
          )}
        </span>
        <h4>{title}</h4>
        <span className={styles.badge} data-status={status}>
          {actionStatusLabel[status]}
        </span>
      </header>
      <dl className={styles.lines}>
        {lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
      {status === 'failed' ? (
        <p className={styles.actionError}>{finaiErrorMessage(state?.errorCode)}</p>
      ) : null}
      {working ? (
        <ThinkingOrb state="working" size={18} caption="Saving…" label="Saving" />
      ) : decidable ? (
        <div className={styles.actionButtons}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => (onConfirm ? onConfirm() : onDecide(actionId, 'confirm'))}
          >
            Confirm
          </button>
          {state?.canCancel !== false && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => (onCancel ? onCancel() : onDecide(actionId, 'cancel'))}
            >
              Cancel
            </button>
          )}
        </div>
      ) : status === 'pending' && state && !state.canDecide ? (
        <p className={styles.caption}>Waiting for the person who asked to confirm.</p>
      ) : null}
    </section>
  );
}

/** Renders one parsed node without the A2UI runtime (fallback path). */
export function FinaiNodeView({ node }: { node: FinaiNode }) {
  switch (node.component) {
    case 'SummaryCard':
      return <SummaryCardView {...node} />;
    case 'TransactionList':
      return <TransactionListView {...node} />;
    case 'BarChart':
      return <BarChartView {...node} />;
    case 'ProgressList':
      return <ProgressListView {...node} />;
    case 'BalanceList':
      return <BalanceListView {...node} />;
    case 'ActionCard':
      return <ActionCardView {...node} />;
  }
}

export const finaiCardStyles = styles;
