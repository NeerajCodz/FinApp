import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CaretRight, CheckCircle, WarningCircle } from 'phosphor-react-native';
import { useTheme } from '../../native/ThemeProvider';
import { ThinkingOrb } from '../../native/ThinkingOrb';
import { fontFamilies } from '../../tokens';
import { formatStepDuration, stepsSummary, type FinaiStep } from '../finai';

/**
 * The tool calls behind a reply, as a collapsible process list: open while FinAI works so
 * each step appears live, folded to a one-line summary once done.
 */
export function FinaiSteps({ steps, busy }: { steps: readonly FinaiStep[]; busy: boolean }) {
  const { tokens } = useTheme();
  const [open, setOpen] = React.useState(busy);
  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!touched.current) setOpen(busy);
  }, [busy]);
  if (!steps.length) return null;
  const small = { fontFamily: fontFamilies.text.medium, fontSize: 12.5, lineHeight: 17 } as const;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${stepsSummary(steps, busy)}. ${open ? 'Hide' : 'Show'} steps`}
        onPress={() => {
          touched.current = true;
          setOpen((value) => !value);
        }}
        hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}
      >
        {busy ? (
          <ThinkingOrb
            state={steps.findLast((step) => step.status === 'running')?.stage ?? 'working'}
            size={14}
          />
        ) : null}
        <Text numberOfLines={1} style={{ ...small, color: tokens.foregroundMuted, flexShrink: 1 }}>
          {stepsSummary(steps, busy)}
        </Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <CaretRight size={12} weight="bold" color={tokens.foregroundMuted} />
        </View>
      </Pressable>
      {open ? (
        <View
          style={{
            marginLeft: 6,
            paddingLeft: 12,
            borderLeftWidth: 1,
            borderLeftColor: tokens.borderSubtle,
            gap: 4,
          }}
        >
          {steps.map((step, index) => (
            <View
              key={`${step.tool}-${step.startedAt}-${index}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 }}
            >
              {step.status === 'running' ? (
                <ThinkingOrb state={step.stage} size={14} />
              ) : step.status === 'error' ? (
                <WarningCircle size={15} weight="fill" color={tokens.destructive} />
              ) : (
                <CheckCircle size={15} weight="fill" color={tokens.positive} />
              )}
              <Text
                style={{
                  ...small,
                  flex: 1,
                  color:
                    step.status === 'error'
                      ? tokens.destructive
                      : step.status === 'running'
                        ? tokens.foreground
                        : tokens.foregroundMuted,
                }}
              >
                {step.label}
                {step.status === 'running' ? '…' : ''}
                {step.status === 'error' ? ' — failed' : ''}
              </Text>
              {step.durationMs !== undefined ? (
                <Text style={{ ...small, color: tokens.foregroundSubtle }}>
                  {formatStepDuration(step.durationMs)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
