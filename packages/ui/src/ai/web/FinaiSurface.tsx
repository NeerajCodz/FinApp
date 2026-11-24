'use client';

/**
 * Renders a FinAI reply's A2UI v0.9 messages with the official React renderer
 * (`@a2ui/react`) and the FinApp component catalog. Card buttons dispatch A2UI actions
 * (`finai.confirm` / `finai.cancel`), which the processor hands to `onDecide`. If the processor
 * rejects a payload, the strictly parsed tree is drawn with the same views instead.
 *
 * Catalog schemas use the zod v3 API (`zod/v3`), which A2UI's binder reads by type name.
 */
import React from 'react';
import { z } from 'zod/v3';
import { A2uiSurface, createComponentImplementation } from '@a2ui/react/v0_9';
import {
  Catalog,
  CommonSchemas,
  MessageProcessor,
  type ActionPayload,
  type ComponentApi,
} from '@a2ui/web_core/v0_9';
import {
  FINAI_CATALOG_ID,
  FINAI_EVENTS,
  parseFinaiSurface,
  type FinaiActionState,
  type FinaiNode,
} from '../finai';
import {
  ActionCardView,
  BalanceListView,
  BarChartView,
  FinaiActionsContext,
  FinaiNodeView,
  ProgressListView,
  SummaryCardView,
  TransactionListView,
  finaiCardStyles,
  type FinaiDecision,
} from './FinaiCards';

const tone = z.enum(['positive', 'negative', 'neutral', 'accent']);
// A2UI's shared schemas come from its own zod copy; keep them opaque to our zod types.
const childList = CommonSchemas.ChildList as unknown as z.ZodTypeAny;
const actionSchema = CommonSchemas.Action as unknown as z.ZodTypeAny;

type ImplProps<P> = {
  props: P;
  buildChild: (id: string, basePath?: string) => React.ReactNode;
};

/**
 * Registers a component with the renderer. A2UI's types are tied to its own nested zod
 * copy, so the API is passed through `ComponentApi` and the props are typed by hand.
 */
function define<P>(name: string, schema: z.ZodTypeAny, View: React.FC<ImplProps<P>>) {
  return createComponentImplementation(
    { name, schema } as unknown as ComponentApi,
    View as unknown as Parameters<typeof createComponentImplementation>[1],
  );
}

type Without<C extends FinaiNode['component']> = Omit<
  Extract<FinaiNode, { component: C }>,
  'id' | 'component'
>;

const Column = define<{ children?: (string | { id: string; basePath?: string })[] }>(
  'Column',
  z.object({ children: childList }),
  ({ props, buildChild }) => (
    <div className={finaiCardStyles.stack}>
      {(props.children ?? []).map((child, index) =>
        typeof child === 'string' ? (
          <React.Fragment key={child}>{buildChild(child)}</React.Fragment>
        ) : (
          <React.Fragment key={`${child.id}-${index}`}>
            {buildChild(child.id, child.basePath)}
          </React.Fragment>
        ),
      )}
    </div>
  ),
);

const SummaryCard = define<Without<'SummaryCard'>>(
  'SummaryCard',
  z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    metrics: z.array(z.object({ label: z.string(), value: z.string(), tone })),
  }),
  ({ props }) => <SummaryCardView {...props} />,
);

const TransactionList = define<Without<'TransactionList'>>(
  'TransactionList',
  z.object({
    title: z.string(),
    emptyText: z.string(),
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        amount: z.string(),
        tone,
      }),
    ),
  }),
  ({ props }) => <TransactionListView {...props} />,
);

const BarChart = define<Without<'BarChart'>>(
  'BarChart',
  z.object({
    title: z.string(),
    bars: z.array(z.object({ label: z.string(), value: z.number(), display: z.string() })),
  }),
  ({ props }) => <BarChartView {...props} />,
);

const ProgressList = define<Without<'ProgressList'>>(
  'ProgressList',
  z.object({
    title: z.string(),
    items: z.array(z.object({ label: z.string(), progress: z.number(), detail: z.string(), tone })),
  }),
  ({ props }) => <ProgressListView {...props} />,
);

const BalanceList = define<Without<'BalanceList'>>(
  'BalanceList',
  z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    members: z.array(z.object({ name: z.string(), amount: z.string(), tone })),
    transfers: z.array(z.object({ from: z.string(), to: z.string(), amount: z.string() })),
  }),
  ({ props }) => <BalanceListView {...props} />,
);

const ActionCard = define<
  Without<'ActionCard'> & { confirm?: () => Promise<void>; cancel?: () => Promise<void> }
>(
  'ActionCard',
  z.object({
    actionId: z.string(),
    title: z.string(),
    lines: z.array(z.object({ label: z.string(), value: z.string() })),
    confirm: actionSchema,
    cancel: actionSchema,
  }),
  ({ props }) => (
    <ActionCardView
      actionId={props.actionId}
      title={props.title}
      lines={props.lines}
      onConfirm={props.confirm ? () => void props.confirm!() : undefined}
      onCancel={props.cancel ? () => void props.cancel!() : undefined}
    />
  ),
);

/** The FinApp A2UI catalog: layout plus finance cards. */
export const finaiCatalog = new Catalog(FINAI_CATALOG_ID, 'v0.9', [
  Column,
  SummaryCard,
  TransactionList,
  BarChart,
  ProgressList,
  BalanceList,
  ActionCard,
]);

export type FinaiSurfaceProps = {
  /** The reply's A2UI messages (JSON string). */
  a2ui: string | undefined;
  actions?: readonly FinaiActionState[];
  onDecide?: (actionId: string, decision: FinaiDecision) => Promise<unknown> | void;
};

class SurfaceBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function FinaiSurface({ a2ui, actions = [], onDecide }: FinaiSurfaceProps) {
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());
  const decideRef = React.useRef(onDecide);
  decideRef.current = onDecide;

  const decide = React.useCallback((actionId: string, decision: FinaiDecision) => {
    const handler = decideRef.current;
    if (!handler) return;
    setBusy((current) => new Set(current).add(actionId));
    void Promise.resolve(handler(actionId, decision)).finally(() =>
      setBusy((current) => {
        const next = new Set(current);
        next.delete(actionId);
        return next;
      }),
    );
  }, []);

  const parsed = React.useMemo(() => parseFinaiSurface(a2ui), [a2ui]);
  const surface = React.useMemo(() => {
    if (!parsed) return null;
    try {
      const processor = new MessageProcessor([finaiCatalog], (action: ActionPayload) => {
        const actionId =
          typeof action.context?.actionId === 'string' ? action.context.actionId : null;
        if (!actionId) return;
        if (action.name === FINAI_EVENTS.confirm) decide(actionId, 'confirm');
        else if (action.name === FINAI_EVENTS.cancel) decide(actionId, 'cancel');
      });
      processor.processMessages(parsed.messages as Parameters<typeof processor.processMessages>[0]);
      return processor.model.surfacesMap.get(parsed.surfaceId) ?? null;
    } catch (error) {
      console.warn('[finai] A2UI payload rejected; drawing parsed cards', error);
      return null;
    }
  }, [parsed, decide]);

  const context = React.useMemo(
    () => ({ actions: new Map(actions.map((row) => [row.id, row])), busy, onDecide: decide }),
    [actions, busy, decide],
  );
  if (!parsed) return null;
  const fallback = (
    <div className={finaiCardStyles.stack}>
      {parsed.nodes.map((node) => (
        <FinaiNodeView key={node.id} node={node} />
      ))}
    </div>
  );
  return (
    <FinaiActionsContext.Provider value={context}>
      {surface ? (
        <SurfaceBoundary fallback={fallback}>
          <A2uiSurface surface={surface} />
        </SurfaceBoundary>
      ) : (
        fallback
      )}
    </FinaiActionsContext.Provider>
  );
}
