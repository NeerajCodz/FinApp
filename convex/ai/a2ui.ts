/**
 * A2UI (https://a2ui.org, protocol v0.9) output for FinAI replies. Tools return typed `FinView`
 * descriptors built from real query results; `buildA2uiMessages` turns them into a
 * `createSurface` + `updateComponents` pair against the FinApp component catalog. The model never
 * writes UI JSON itself, so every card shows server-computed numbers.
 *
 * Clients render the same catalog: the web with `@a2ui/react`, mobile with a native renderer
 * (`packages/ui/src/ai`). Keep component names and props in sync with `finaiCatalog` there.
 */

export const FINAI_CATALOG_ID = 'https://fin.neeraj.fyi/a2ui/finapp/v1/catalog.json';
export const A2UI_VERSION = 'v0.9';

export type Tone = 'positive' | 'negative' | 'neutral' | 'accent';

export type SummaryMetric = { label: string; value: string; tone?: Tone };
export type ListItem = {
  id: string;
  title: string;
  subtitle?: string;
  amount: string;
  tone?: Tone;
};
export type Bar = { label: string; value: number; display: string };
export type ProgressItem = { label: string; progress: number; detail: string; tone?: Tone };
export type BalanceMember = { name: string; amount: string; tone?: Tone };
export type BalanceTransfer = { from: string; to: string; amount: string };
export type ActionLine = { label: string; value: string };

export type FinView =
  | { kind: 'summary'; title: string; subtitle?: string; metrics: SummaryMetric[] }
  | { kind: 'transactions'; title: string; items: ListItem[]; emptyText?: string }
  | { kind: 'bars'; title: string; bars: Bar[] }
  | { kind: 'progress'; title: string; items: ProgressItem[] }
  | {
      kind: 'balances';
      title: string;
      subtitle?: string;
      members: BalanceMember[];
      transfers: BalanceTransfer[];
    }
  | { kind: 'action'; actionId: string; title: string; lines: ActionLine[] };

/** Event names the catalog's buttons dispatch; clients route them to `ai.actions`. */
export const FINAI_EVENTS = { confirm: 'finai.confirm', cancel: 'finai.cancel' } as const;

export const A2UI_LIMITS = { views: 4, items: 8, bars: 8, members: 12, lines: 8 } as const;

type Component = { id: string; component: string } & Record<string, unknown>;
export type A2uiMessage =
  | { version: typeof A2UI_VERSION; createSurface: { surfaceId: string; catalogId: string } }
  | {
      version: typeof A2UI_VERSION;
      updateComponents: { surfaceId: string; components: Component[] };
    };

const clip = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;
const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function action(name: string, actionId: string) {
  return { event: { name, context: { actionId } } };
}

function component(view: FinView, id: string): Component {
  switch (view.kind) {
    case 'summary':
      return {
        id,
        component: 'SummaryCard',
        title: clip(view.title),
        ...(view.subtitle ? { subtitle: clip(view.subtitle) } : {}),
        metrics: view.metrics.slice(0, 6).map((metric) => ({
          label: clip(metric.label, 40),
          value: clip(metric.value, 40),
          tone: metric.tone ?? 'neutral',
        })),
      };
    case 'transactions':
      return {
        id,
        component: 'TransactionList',
        title: clip(view.title),
        emptyText: view.emptyText ?? 'Nothing to show.',
        items: view.items.slice(0, A2UI_LIMITS.items).map((item) => ({
          id: item.id,
          title: clip(item.title, 80),
          ...(item.subtitle ? { subtitle: clip(item.subtitle, 80) } : {}),
          amount: clip(item.amount, 40),
          tone: item.tone ?? 'neutral',
        })),
      };
    case 'bars': {
      const bars = view.bars.slice(0, A2UI_LIMITS.bars);
      return {
        id,
        component: 'BarChart',
        title: clip(view.title),
        bars: bars.map((bar) => ({
          label: clip(bar.label, 32),
          value: Number.isFinite(bar.value) ? Math.max(0, bar.value) : 0,
          display: clip(bar.display, 40),
        })),
      };
    }
    case 'progress':
      return {
        id,
        component: 'ProgressList',
        title: clip(view.title),
        items: view.items.slice(0, A2UI_LIMITS.items).map((item) => ({
          label: clip(item.label, 60),
          progress: clamp01(item.progress),
          detail: clip(item.detail, 60),
          tone: item.tone ?? 'accent',
        })),
      };
    case 'balances':
      return {
        id,
        component: 'BalanceList',
        title: clip(view.title),
        ...(view.subtitle ? { subtitle: clip(view.subtitle) } : {}),
        members: view.members.slice(0, A2UI_LIMITS.members).map((member) => ({
          name: clip(member.name, 60),
          amount: clip(member.amount, 40),
          tone: member.tone ?? 'neutral',
        })),
        transfers: view.transfers.slice(0, A2UI_LIMITS.members).map((transfer) => ({
          from: clip(transfer.from, 60),
          to: clip(transfer.to, 60),
          amount: clip(transfer.amount, 40),
        })),
      };
    case 'action':
      return {
        id,
        component: 'ActionCard',
        actionId: view.actionId,
        title: clip(view.title),
        lines: view.lines.slice(0, A2UI_LIMITS.lines).map((line) => ({
          label: clip(line.label, 40),
          value: clip(line.value, 120),
        })),
        confirm: action(FINAI_EVENTS.confirm, view.actionId),
        cancel: action(FINAI_EVENTS.cancel, view.actionId),
      };
  }
}

/**
 * The A2UI messages for one reply: a surface whose root `Column` holds one component per view
 * (at most `A2UI_LIMITS.views`, keeping confirmation cards first). Returns null without views.
 */
export function buildA2uiMessages(
  surfaceId: string,
  views: readonly FinView[],
): A2uiMessage[] | null {
  if (!views.length) return null;
  const ordered = [
    ...views.filter((view) => view.kind === 'action'),
    ...views.filter((view) => view.kind !== 'action'),
  ].slice(0, A2UI_LIMITS.views);
  const children = ordered.map((view, index) => component(view, `view-${index}`));
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: FINAI_CATALOG_ID } },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId,
        components: [
          { id: 'root', component: 'Column', children: children.map((child) => child.id) },
          ...children,
        ],
      },
    },
  ];
}
