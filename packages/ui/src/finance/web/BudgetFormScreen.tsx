'use client';
import { Button, Select } from '@finapp/ui/web';
import { Lightbulb, Target, Bell, RefreshCw, ChartNoAxesCombined } from 'lucide-react';
import { parseMinor } from '@convex/shared/money';
import { EntityIconPicker } from './EntityIconPicker';
import { CategoryIcon } from './CategoryIcon';
import { formatMinor } from '../money';
import {
  budgetDashboard,
  type BudgetSettings,
  type BudgetDashboardTransaction,
} from '../budgetDashboard';
import { Panel, Metrics, Ring, Bar } from './GoalsBudgetsParts';
import { BudgetTable } from './BudgetDashboardParts';
import s from './GoalsBudgets.module.css';
export type BudgetCategoryOption = { id: string; name: string; icon?: string };
export type BudgetFormScreenProps = {
  mode: 'create' | 'edit';
  name: string;
  amount: string;
  currency: string;
  categoryId: string;
  categories: readonly BudgetCategoryOption[];
  startDate: string;
  endDate: string;
  loading?: boolean;
  pending?: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onCategoryChange: (id: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  settings?: BudgetSettings;
  onSettingsChange?: (value: BudgetSettings) => void;
  accounts?: readonly { id: string; name: string }[];
  transactions?: readonly BudgetDashboardTransaction[];
  onOpenTransaction?: (id: string) => void;
  onAnalytics?: () => void;
  onArchive?: () => void;
  presets?: readonly { name: string; categoryId: string; amount: string; description: string }[];
};
export function BudgetFormScreen(p: BudgetFormScreenProps) {
  const creating = p.mode === 'create';
  const settings = p.settings ?? {};
  const set = (next: Partial<BudgetSettings>) => p.onSettingsChange?.({ ...settings, ...next });
  const category = p.categories.find((c) => c.id === p.categoryId);
  let limit = 0n;
  try {
    limit = parseMinor(p.amount || '0', p.currency);
  } catch {}
  const start = new Date(`${p.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${p.endDate}T00:00:00Z`).getTime();
  const m = budgetDashboard(
    p.transactions ?? [],
    Number.isFinite(start) ? start : Date.now(),
    Number.isFinite(end) ? end : Date.now() + 86400000,
    limit,
  );
  const basic = (
    <div className={s.fields}>
      <label className={s.field}>
        Budget name
        <input
          value={p.name}
          maxLength={80}
          required
          onChange={(e) => p.onNameChange(e.target.value)}
          placeholder="e.g. Food, Entertainment, Monthly Groceries"
        />
        <small>Choose a name that helps you identify this budget.</small>
      </label>
      <div className={s.field}>
        <Select
          label="Category"
          value={p.categoryId}
          onChange={p.onCategoryChange}
          required
          options={[
            { value: '', label: 'Select category' },
            ...p.categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
      </div>
      <label className={s.field}>
        Spending limit ({p.currency})
        <input
          value={p.amount}
          inputMode="decimal"
          required
          onChange={(e) => p.onAmountChange(e.target.value)}
          placeholder="0"
        />
        <small>Set the maximum amount you want to spend.</small>
      </label>
      <label className={s.field}>
        Alert threshold (%)
        <input
          type="number"
          min={0}
          max={100}
          value={settings.alertThreshold ?? 80}
          disabled={!p.onSettingsChange}
          onChange={(e) => set({ alertThreshold: Number(e.target.value) })}
        />
        <small>Get notified when you reach this percentage.</small>
      </label>
      <label className={s.field}>
        Starts (UTC)
        <input
          type="date"
          value={p.startDate}
          required
          onChange={(e) => p.onStartDateChange(e.target.value)}
        />
      </label>
      <label className={s.field}>
        Ends (exclusive, UTC)
        <input
          type="date"
          value={p.endDate}
          required
          onChange={(e) => p.onEndDateChange(e.target.value)}
        />
        <small>Expenses on this date are outside the budget.</small>
      </label>
    </div>
  );
  const scope = (
    <>
      <p className={s.muted}>Choose which accounts to include in this budget.</p>
      <div className={s.fields}>
        <label className={s.choice}>
          <input
            type="radio"
            name="scope"
            checked={!settings.accountIds?.length}
            disabled={!p.onSettingsChange}
            onChange={() => set({ accountIds: [] })}
          />
          <span>
            <strong>All accounts</strong>
            <br />
            <span className={s.muted}>Include posted expenses from all linked accounts.</span>
          </span>
        </label>
        <label className={s.choice}>
          <input
            type="radio"
            name="scope"
            checked={!!settings.accountIds?.length}
            disabled={!p.onSettingsChange || !p.accounts?.length}
            onChange={() => set({ accountIds: p.accounts?.[0] ? [p.accounts[0].id] : [] })}
          />
          <span>
            <strong>Select accounts</strong>
            <br />
            <span className={s.muted}>Choose specific accounts for this budget.</span>
          </span>
        </label>
      </div>
      {(creating ? !!settings.accountIds?.length : true) && (
        <div className={s.stack} style={{ marginTop: 12 }}>
          {p.accounts?.map((a) => (
            <label className={s.choice} key={a.id}>
              <input
                type="checkbox"
                checked={settings.accountIds?.includes(a.id) ?? false}
                disabled={!p.onSettingsChange}
                onChange={(e) =>
                  set({
                    accountIds: e.target.checked
                      ? [...(settings.accountIds ?? []), a.id]
                      : (settings.accountIds ?? []).filter((id) => id !== a.id),
                  })
                }
              />
              {a.name}
            </label>
          ))}
          {!p.accounts?.length && (
            <p className={s.muted}>No available accounts for this currency.</p>
          )}
        </div>
      )}
    </>
  );
  const additional = (
    <>
      <label className={s.switch}>
        <span>
          Include in analytics
          <br />
          <small className={s.muted}>Show this budget in charts and insights.</small>
        </span>
        <input
          type="checkbox"
          checked={settings.includeInAnalytics !== false}
          disabled={!p.onSettingsChange}
          onChange={(e) => set({ includeInAnalytics: e.target.checked })}
        />
      </label>
      <div className={s.divider}>
        <label className={s.field}>
          Notes (optional)
          <textarea
            rows={2}
            value={settings.notes ?? ''}
            maxLength={300}
            disabled={!p.onSettingsChange}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="e.g. Keep dining out under control, only for weekends."
          />
          <small>{settings.notes?.length ?? 0}/300</small>
        </label>
      </div>
    </>
  );
  return (
    <div className={s.page}>
      <button className={s.back} onClick={p.onBack}>
        ‹ Budgets › {creating ? 'New budget' : `${p.name} › Edit`}
      </button>
      <header className={s.header}>
        <div className={s.actions}>
          {!creating && (
            <span className={`${s.tile} ${s.heroTile}`}>
              <CategoryIcon
                label={category?.name ?? 'Category'}
                icon={settings.icon ?? category?.icon}
              />
            </span>
          )}
          <div>
            <h1 className={s.heading}>{creating ? 'New budget' : p.name || 'Edit budget'}</h1>
            <p className={s.subtitle}>
              {creating
                ? 'Set a spending limit, choose a category and get insights to stay on track.'
                : 'Edit your budget details, limits and settings.'}
            </p>
          </div>
        </div>
        {!creating && (
          <div className={s.actions}>
            {p.onAnalytics && (
              <Button variant="outline" onPress={p.onAnalytics}>
                View analytics
              </Button>
            )}
            {p.onArchive && (
              <Button variant="outline" onPress={p.onArchive} disabled={p.pending}>
                Archive budget
              </Button>
            )}
          </div>
        )}
      </header>
      {!creating && (
        <Metrics
          items={[
            {
              label: 'Current period usage',
              value: formatMinor(m.spent, p.currency),
              detail: `${Math.round(m.ratio)}% used of ${formatMinor(limit, p.currency)}`,
            },
            {
              label: 'Remaining',
              value: formatMinor(m.remaining, p.currency),
              detail: 'Within this date range',
            },
            {
              label: 'Daily average',
              value: formatMinor(m.average, p.currency),
              detail: 'Per elapsed day',
            },
            {
              label: 'Projected spend',
              value: formatMinor(m.forecast, p.currency),
              detail: m.forecast <= limit ? 'On track' : 'Over limit at this pace',
            },
          ]}
        />
      )}
      <form
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          p.onSubmit();
        }}
      >
        {p.loading ? (
          <p role="status">Loading categories and currency…</p>
        ) : (
          <>
            <div className={s.two}>
              <div className={s.stack}>
                <Panel
                  title={creating ? 'Basic details' : 'Basic information'}
                  description="Give your budget a name, set a limit and choose how it works."
                >
                  {basic}
                  {creating && (
                    <>
                      <div className={s.divider}>
                        <h2>Account scope</h2>
                        {scope}
                      </div>
                      <div className={s.divider}>
                        <h2>Notifications & settings</h2>
                        {additional}
                        <div className={s.insight}>
                          <RefreshCw size={20} />
                          <span>
                            Rollover and automatic adjustments are not available. This budget uses
                            the explicit dates and limit above.
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </Panel>
                {!creating && (
                  <div className={s.fields}>
                    <Panel title="Rollover behavior">
                      <p className={s.muted}>
                        Unused amounts do not carry forward. This budget has an explicit start and
                        end.
                      </p>
                    </Panel>
                    <Panel title="Status">
                      <p className={s.positive}>● Active</p>
                      <p className={s.muted}>Archive this budget to stop tracking it.</p>
                    </Panel>
                  </div>
                )}
              </div>
              <aside className={s.stack}>
                {creating ? (
                  <>
                    <Panel
                      title="Budget setup tips"
                      description="Make the most of your budgets with these tips."
                    >
                      {[
                        [
                          Target,
                          'Be specific',
                          'Set realistic limits based on your past spending and financial goals.',
                        ],
                        [
                          ChartNoAxesCombined,
                          'Start with key categories',
                          'Focus on high-impact areas like food, shopping and entertainment.',
                        ],
                        [
                          Bell,
                          'Use alerts',
                          'Get notified before you reach your limit to stay on track.',
                        ],
                        [
                          RefreshCw,
                          'Adjust as you go',
                          'Review and update your limits as your spending habits change.',
                        ],
                      ].map(([Icon, title, text]) => {
                        const I = Icon as typeof Target;
                        return (
                          <div className={s.row} key={String(title)}>
                            <span className={s.tile}>
                              <I size={25} />
                            </span>
                            <span>
                              <strong>{String(title)}</strong>
                              <br />
                              <span className={s.muted}>{String(text)}</span>
                            </span>
                          </div>
                        );
                      })}
                    </Panel>
                    <Panel
                      title="Popular budget presets"
                      description="Suggested amounts from your actual spending history."
                    >
                      {p.presets?.length ? (
                        p.presets.map((preset) => (
                          <div className={s.row} key={preset.name}>
                            <span className={s.grow}>
                              <strong>{preset.name}</strong>
                              <br />
                              <span className={s.muted}>{preset.description}</span>
                            </span>
                            <span>
                              {preset.amount} {p.currency}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              onPress={() => {
                                p.onNameChange(preset.name);
                                p.onCategoryChange(preset.categoryId);
                                p.onAmountChange(preset.amount);
                              }}
                            >
                              Use preset
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className={s.muted}>
                          Record category expenses to get spending-based presets. No preset amounts
                          have been invented.
                        </p>
                      )}
                    </Panel>
                  </>
                ) : (
                  <>
                    <Panel
                      title="Budget icon"
                      description="Choose an icon to identify this budget."
                    >
                      <div className={s.actions}>
                        <span className={`${s.tile} ${s.heroTile}`}>
                          <CategoryIcon
                            label={category?.name ?? 'Category'}
                            icon={settings.icon ?? category?.icon}
                          />
                        </span>
                        <EntityIconPicker
                          mode="all"
                          value={settings.icon ?? category?.icon}
                          onChange={(icon) => set({ icon })}
                          label="Change icon"
                        />
                      </div>
                    </Panel>
                    <Panel title="Linked accounts">{scope}</Panel>
                    <Panel title="Additional settings">{additional}</Panel>
                  </>
                )}
              </aside>
            </div>
            {!creating && (
              <Panel
                title="Recent transactions"
                description="Showing your latest posted expenses for this budget."
              >
                <BudgetTable
                  rows={[...(p.transactions ?? [])].sort((a, b) => b.occurredAt - a.occurredAt)}
                  onOpen={p.onOpenTransaction}
                />
              </Panel>
            )}
          </>
        )}
        {p.error && (
          <p className={s.error} role="alert">
            {p.error}
          </p>
        )}
        <div className={s.actions}>
          <Button
            type="submit"
            disabled={p.loading || p.pending || !p.name.trim() || !p.categoryId}
          >
            {p.pending ? 'Saving…' : creating ? 'Create budget' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" disabled={p.pending} onPress={p.onBack}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
