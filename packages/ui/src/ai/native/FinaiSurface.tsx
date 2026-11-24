/**
 * Native A2UI renderer for FinAI replies. There is no official React Native renderer, so this
 * draws the FinApp catalog (the same components the web registers with `@a2ui/react`) from the
 * strictly parsed A2UI v0.9 messages, using theme tokens and the app's primitives. Card buttons
 * dispatch the catalog's `finai.confirm` / `finai.cancel` events to `onDecide`.
 */
import React from 'react';
import { View } from 'react-native';
import { ArrowRight, CheckCircle, Sparkle, XCircle } from 'phosphor-react-native';
import { Button, ThinkingOrb, Typography, useTheme } from '@finapp/ui/native';
import { withAlpha, type ThemeTokens } from '../../tokens';
import {
  actionStatusLabel,
  FINAI_EVENTS,
  finaiErrorMessage,
  parseFinaiSurface,
  type FinaiActionState,
  type FinaiNode,
  type FinaiTone,
} from '../finai';

export type FinaiDecision = 'confirm' | 'cancel';

export type FinaiSurfaceProps = {
  a2ui: string | undefined;
  actions?: readonly FinaiActionState[];
  onDecide?: (actionId: string, decision: FinaiDecision) => Promise<unknown> | void;
};

const toneColor = (tokens: ThemeTokens, tone: FinaiTone) =>
  tone === 'positive'
    ? tokens.income
    : tone === 'negative'
      ? tokens.expense
      : tone === 'accent'
        ? tokens.primary
        : tokens.foreground;

function Card({
  title,
  subtitle,
  children,
  highlight,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: highlight ? withAlpha(tokens.primary, 0.35) : tokens.borderSubtle,
        backgroundColor: highlight ? withAlpha(tokens.primary, 0.06) : tokens.card,
      }}
    >
      {title ? (
        <View>
          <Typography variant="label">{title}</Typography>
          {subtitle ? <Typography variant="caption">{subtitle}</Typography> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: tokens.borderSubtle,
      }}
    >
      {children}
    </View>
  );
}

function ActionCard({
  node,
  state,
  busy,
  onDecide,
}: {
  node: Extract<FinaiNode, { component: 'ActionCard' }>;
  state?: FinaiActionState;
  busy: boolean;
  onDecide?: (event: string) => void;
}) {
  const { tokens } = useTheme();
  const status = state?.status ?? 'pending';
  const working = busy || status === 'running';
  const decidable = !!state?.canDecide && status === 'pending' && !working && !!onDecide;
  const Icon =
    status === 'done'
      ? CheckCircle
      : status === 'failed' || status === 'cancelled' || status === 'expired'
        ? XCircle
        : Sparkle;
  const iconColor =
    status === 'done'
      ? tokens.income
      : status === 'pending' || status === 'running'
        ? tokens.primary
        : tokens.foregroundSubtle;
  return (
    <Card highlight={status === 'pending' || status === 'running'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon size={20} color={iconColor} weight="fill" />
        <Typography variant="label" style={{ flex: 1 }}>
          {node.title}
        </Typography>
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: status === 'pending' ? tokens.primary : tokens.surfaceRaised,
          }}
        >
          <Typography
            variant="caption"
            style={{
              fontSize: 11,
              color:
                status === 'pending'
                  ? tokens.primaryForeground
                  : status === 'done'
                    ? tokens.income
                    : tokens.foregroundMuted,
            }}
          >
            {actionStatusLabel[status]}
          </Typography>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {node.lines.map((line) => (
          <View
            key={line.label}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
          >
            <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
              {line.label}
            </Typography>
            <Typography variant="small" style={{ flexShrink: 1, textAlign: 'right' }}>
              {line.value}
            </Typography>
          </View>
        ))}
      </View>
      {status === 'failed' ? (
        <Typography variant="caption" style={{ color: tokens.destructive }}>
          {finaiErrorMessage(state?.errorCode)}
        </Typography>
      ) : null}
      {working ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ThinkingOrb state="working" size={20} label="Saving" />
          <Typography variant="caption">Saving…</Typography>
        </View>
      ) : decidable ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button size="sm" style={{ flex: 1 }} onPress={() => onDecide?.(FINAI_EVENTS.confirm)}>
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => onDecide?.(FINAI_EVENTS.cancel)}
          >
            Cancel
          </Button>
        </View>
      ) : status === 'pending' && state && !state.canDecide ? (
        <Typography variant="caption">Waiting for the person who asked to confirm.</Typography>
      ) : null}
    </Card>
  );
}

function NodeView({
  node,
  actions,
  busy,
  dispatch,
}: {
  node: FinaiNode;
  actions: ReadonlyMap<string, FinaiActionState>;
  busy: ReadonlySet<string>;
  dispatch?: (event: string, actionId: string) => void;
}) {
  const { tokens } = useTheme();
  switch (node.component) {
    case 'SummaryCard':
      return (
        <Card title={node.title} subtitle={node.subtitle}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {node.metrics.map((metric) => (
              <View
                key={metric.label}
                style={{
                  flexGrow: 1,
                  minWidth: 96,
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                <Typography variant="caption">{metric.label}</Typography>
                <Typography
                  variant="heading"
                  style={{ color: toneColor(tokens, metric.tone), fontVariant: ['tabular-nums'] }}
                >
                  {metric.value}
                </Typography>
              </View>
            ))}
          </View>
        </Card>
      );
    case 'TransactionList':
      return (
        <Card title={node.title}>
          {node.items.length ? (
            <View>
              {node.items.map((item) => (
                <Row key={item.id}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor:
                        item.tone === 'neutral'
                          ? tokens.foregroundSubtle
                          : toneColor(tokens, item.tone),
                    }}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="small" numberOfLines={1}>
                      {item.title}
                    </Typography>
                    {item.subtitle ? (
                      <Typography variant="caption" numberOfLines={1}>
                        {item.subtitle}
                      </Typography>
                    ) : null}
                  </View>
                  <Typography
                    variant="small"
                    style={{ color: toneColor(tokens, item.tone), fontVariant: ['tabular-nums'] }}
                  >
                    {item.amount}
                  </Typography>
                </Row>
              ))}
            </View>
          ) : (
            <Typography variant="caption">{node.emptyText}</Typography>
          )}
        </Card>
      );
    case 'BarChart': {
      const max = Math.max(1, ...node.bars.map((bar) => bar.value));
      return (
        <Card title={node.title}>
          <View style={{ gap: 10 }} accessibilityLabel={node.title}>
            {node.bars.map((bar, index) => (
              <View key={`${bar.label}-${index}`} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Typography
                    variant="caption"
                    numberOfLines={1}
                    style={{ flex: 1, color: tokens.foreground }}
                  >
                    {bar.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    style={{ color: tokens.foreground, fontVariant: ['tabular-nums'] }}
                  >
                    {bar.display}
                  </Typography>
                </View>
                <View
                  style={{
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: tokens.surfaceSubtle,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(4, (bar.value / max) * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      backgroundColor: tokens.primary,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      );
    }
    case 'ProgressList':
      return (
        <Card title={node.title}>
          <View style={{ gap: 10 }}>
            {node.items.map((item) => (
              <View key={item.label} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Typography variant="small">{item.label}</Typography>
                  <Typography variant="caption">{item.detail}</Typography>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={item.label}
                  accessibilityValue={{ min: 0, max: 100, now: Math.round(item.progress * 100) }}
                  style={{
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: tokens.surfaceSubtle,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(item.progress * 100)}%`,
                      height: '100%',
                      borderRadius: 999,
                      backgroundColor: toneColor(
                        tokens,
                        item.tone === 'neutral' ? 'accent' : item.tone,
                      ),
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      );
    case 'BalanceList':
      return (
        <Card title={node.title} subtitle={node.subtitle}>
          <View>
            {node.members.map((member) => (
              <Row key={member.name}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      member.tone === 'neutral'
                        ? tokens.surfaceSubtle
                        : withAlpha(toneColor(tokens, member.tone), 0.16),
                  }}
                >
                  <Typography variant="caption" style={{ color: toneColor(tokens, member.tone) }}>
                    {member.name.slice(0, 1).toUpperCase()}
                  </Typography>
                </View>
                <Typography variant="small" style={{ flex: 1 }} numberOfLines={1}>
                  {member.name}
                </Typography>
                <Typography variant="small" style={{ color: toneColor(tokens, member.tone) }}>
                  {member.amount}
                </Typography>
              </Row>
            ))}
          </View>
          {node.transfers.length ? (
            <View
              style={{
                gap: 6,
                padding: 10,
                borderRadius: 14,
                backgroundColor: tokens.surfaceSubtle,
              }}
            >
              <Typography variant="caption">Suggested transfers</Typography>
              {node.transfers.map((transfer, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Typography variant="small">{transfer.from}</Typography>
                  <ArrowRight size={14} color={tokens.foregroundMuted} />
                  <Typography variant="small" style={{ flex: 1 }}>
                    {transfer.to}
                  </Typography>
                  <Typography variant="label">{transfer.amount}</Typography>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      );
    case 'ActionCard':
      return (
        <ActionCard
          node={node}
          state={actions.get(node.actionId)}
          busy={busy.has(node.actionId)}
          onDecide={dispatch ? (event) => dispatch(event, node.actionId) : undefined}
        />
      );
  }
}

export function FinaiSurface({ a2ui, actions = [], onDecide }: FinaiSurfaceProps) {
  const surface = React.useMemo(() => parseFinaiSurface(a2ui), [a2ui]);
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());
  const byId = React.useMemo(() => new Map(actions.map((row) => [row.id, row])), [actions]);
  if (!surface) return null;
  const dispatch = onDecide
    ? (event: string, actionId: string) => {
        const decision: FinaiDecision | null =
          event === FINAI_EVENTS.confirm
            ? 'confirm'
            : event === FINAI_EVENTS.cancel
              ? 'cancel'
              : null;
        if (!decision) return;
        setBusy((current) => new Set(current).add(actionId));
        void Promise.resolve(onDecide(actionId, decision)).finally(() =>
          setBusy((current) => {
            const next = new Set(current);
            next.delete(actionId);
            return next;
          }),
        );
      }
    : undefined;
  return (
    <View style={{ gap: 10, marginTop: 8, alignSelf: 'stretch' }}>
      {surface.nodes.map((node) => (
        <NodeView key={node.id} node={node} actions={byId} busy={busy} dispatch={dispatch} />
      ))}
    </View>
  );
}
