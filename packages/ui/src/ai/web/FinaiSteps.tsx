'use client';

import React from 'react';
import { CaretRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { ThinkingOrb } from '../../web/ThinkingOrb';
import { formatStepDuration, stepsSummary, type FinaiStep } from '../finai';
import styles from './FinaiSteps.module.css';

/**
 * The tool calls behind a reply, as a collapsible process list (like ChatGPT and Claude):
 * open while FinAI works, so each step appears live; folded to a one-line summary once done.
 */
export function FinaiSteps({ steps, busy }: { steps: readonly FinaiStep[]; busy: boolean }) {
  const [open, setOpen] = React.useState(busy);
  // Follow the reply's state until the reader toggles it themselves.
  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!touched.current) setOpen(busy);
  }, [busy]);
  if (!steps.length) return null;
  const listId = `finai-steps-${steps[0]!.startedAt}`;
  return (
    <div className={styles.steps} data-busy={busy || undefined}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          touched.current = true;
          setOpen((value) => !value);
        }}
      >
        {busy ? (
          <ThinkingOrb
            state={steps.findLast((step) => step.status === 'running')?.stage ?? 'working'}
            size={14}
          />
        ) : null}
        <span className={styles.summary}>{stepsSummary(steps, busy)}</span>
        <CaretRight size={12} weight="bold" className={styles.caret} aria-hidden />
      </button>
      {open ? (
        <ol id={listId} className={styles.list}>
          {steps.map((step, index) => (
            <li key={`${step.tool}-${step.startedAt}-${index}`} data-status={step.status}>
              <span className={styles.icon} aria-hidden>
                {step.status === 'running' ? (
                  <ThinkingOrb state={step.stage} size={14} />
                ) : step.status === 'error' ? (
                  <WarningCircle size={15} weight="fill" />
                ) : (
                  <CheckCircle size={15} weight="fill" />
                )}
              </span>
              <span className={styles.label}>
                {step.label}
                {step.status === 'running' ? '…' : ''}
                {step.status === 'error' ? ' — failed' : ''}
              </span>
              {step.durationMs !== undefined ? (
                <span className={styles.duration}>{formatStepDuration(step.durationMs)}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
