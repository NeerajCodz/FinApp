'use client';
import React from 'react';
import { Button, HeroCard, IconTile, StatusPill, Switch, useTheme } from '@finapp/ui/web';
import { Illustration } from '@finapp/ui/illustrations';
import { formatMinor } from '@convex/shared/money';
import type { AllocationTone, GroupExpenseMethod } from '../groupExpenseDraft';
import {
  composerStepLabels,
  composerSteps,
  type ComposerStep,
  type ExpenseComposer,
} from '../useExpenseComposer';
import { DateTimePicker } from './DateTimePicker';
import { EntityIcon } from './EntityIconPicker';
import { Crumb, GroupPage, PersonAvatar, Tile } from './GroupUI';
import f from './SplitFlow.module.css';
import { LineItemsEditor } from './LineItems';

export type { GroupExpenseMethod } from '../groupExpenseDraft';
export type GroupExpenseGroupOption = { id: string; name: string; currency?: string };
export type GroupExpenseAccountOption = { id: string; name: string };
export type GroupExpenseMemberOption = {
  userId: string;
  name: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
export type GroupExpenseShare = { userId: string; amountMinor: bigint };
export type GroupExpenseCategoryOption = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
};
export type GroupExpenseFormScreenProps = {
  signedIn: boolean;
  mode?: 'create' | 'edit';
  loading?: boolean;
  dataError?: string;
  unavailableMessage?: string;
  onRetry?: () => void;
  fixedGroupId?: string;
  groups: readonly GroupExpenseGroupOption[];
  selectedGroupId: string;
  groupName?: string;
  groupIcon?: string;
  groupColor?: string;
  currency: string;
  accounts: readonly GroupExpenseAccountOption[];
  /** The expense stays on its creator's account (an admin editing someone else's expense). */
  accountLocked?: boolean;
  categories?: readonly GroupExpenseCategoryOption[];
  members: readonly GroupExpenseMemberOption[];
  currentUserId?: string | null;
  composer: ExpenseComposer;
  /**
   * New expenses are recorded with you as the payer (that is what the server accepts when
   * adding). Choosing someone else, or several payers, is available when editing.
   */
  payerEditable: boolean;
  offline?: boolean;
  error?: string;
  saving?: boolean;
  onGroupChange?: (id: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onCreateGroup?: () => void;
  onSignIn?: () => void;
};

const methods: readonly {
  value: GroupExpenseMethod;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'equal',
    title: 'Equally',
    description: 'Everyone pays the same',
    icon: 'phosphor:UsersThree',
  },
  {
    value: 'exact',
    title: 'Exact',
    description: 'Type each amount',
    icon: 'phosphor:SlidersHorizontal',
  },
  {
    value: 'percentage',
    title: 'Percent',
    description: 'Shares of 100%',
    icon: 'phosphor:Percent',
  },
  { value: 'shares', title: 'Shares', description: 'Units, e.g. 2 : 1', icon: 'phosphor:ChartBar' },
  { value: 'itemized', title: 'By item', description: 'Who had what', icon: 'phosphor:Receipt' },
];

export function allocationTone(tone: AllocationTone) {
  return tone === 'positive' ? 'income' : tone === 'warning' ? 'warning' : 'destructive';
}

function money(value: bigint | null | undefined, currency: string): string {
  if (value === null || value === undefined) return '—';
  try {
    return formatMinor(value, currency);
  } catch {
    return value.toString();
  }
}

export function GroupExpenseFormScreen(p: GroupExpenseFormScreenProps) {
  const c = p.composer;
  const [stepIndex, setStepIndex] = React.useState(0);
  const step: ComposerStep = composerSteps[stepIndex]!;
  const stepError = c.stepErrors[step];
  const isLast = stepIndex === composerSteps.length - 1;
  const groupReady = Boolean(p.selectedGroupId);
  const title = p.mode === 'edit' ? 'Edit expense' : 'New expense';
  if (!p.signedIn || p.loading || p.dataError || p.unavailableMessage)
    return (
      <GroupPage>
        <Crumb onBack={p.onBack} name={p.groupName} current={title} />
        <section className={`${f.panel} ${f.center}`}>
          <Illustration
            scene={!p.signedIn ? 'welcome' : p.loading ? 'splitBill' : 'error'}
            size={180}
          />
          {!p.signedIn ? (
            <>
              <h1>Sign in to split an expense</h1>
              <Button onPress={p.onSignIn}>Sign in</Button>
            </>
          ) : p.loading ? (
            <p role="status">Loading expense…</p>
          ) : (
            <>
              <p role="alert">{p.dataError || p.unavailableMessage}</p>
              {p.dataError && p.onRetry && (
                <Button variant="outline" onPress={p.onRetry}>
                  Retry
                </Button>
              )}
            </>
          )}
        </section>
      </GroupPage>
    );
  const memberById = (id: string) => p.members.find((member) => member.userId === id);
  return (
    <GroupPage>
      <Crumb onBack={p.onBack} name={p.groupName} current={title} />
      <form
        className={f.layout}
        onSubmit={(event) => {
          event.preventDefault();
          if (!isLast) {
            if (!stepError) setStepIndex(stepIndex + 1);
          } else if (!c.validation) p.onSubmit();
        }}
      >
        <div className={f.stack}>
          <HeroCard tone="split">
            <div className={f.hero}>
              <div className={f.heroCopy}>
                <span className={f.overline}>{p.groupName ?? 'Shared expense'}</span>
                <p className={f.total} aria-live="polite">
                  {c.draft.totalMinor === null
                    ? money(0n, p.currency || 'INR')
                    : money(c.draft.totalMinor, p.currency)}
                </p>
                <p className={f.muted}>
                  {c.title.trim() || 'What was it for?'} · {c.participantIds.length}{' '}
                  {c.participantIds.length === 1 ? 'person' : 'people'}
                </p>
              </div>
              <Illustration scene="splitBill" size={150} backdrop={false} />
            </div>
            <ol className={f.steps} aria-label="Steps">
              {composerSteps.map((key, index) => {
                const reachable =
                  index <= stepIndex ||
                  composerSteps.slice(0, index).every((prior) => !c.stepErrors[prior]);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={f.step}
                      aria-current={index === stepIndex ? 'step' : undefined}
                      data-done={(!c.stepErrors[key] && index !== stepIndex) || undefined}
                      disabled={!reachable}
                      onClick={() => setStepIndex(index)}
                    >
                      {index + 1}. {composerStepLabels[key]}
                    </button>
                  </li>
                );
              })}
            </ol>
          </HeroCard>

          {!p.fixedGroupId && (
            <section className={f.panel}>
              <StepTitle
                icon="phosphor:UsersThree"
                title="Which group?"
                hint="Expenses live in a group"
              />
              <div className={f.choices} role="radiogroup" aria-label="Group">
                {p.groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    role="radio"
                    className={f.choice}
                    aria-checked={group.id === p.selectedGroupId}
                    onClick={() => p.onGroupChange?.(group.id)}
                  >
                    <strong>{group.name}</strong>
                    <small>{group.currency ?? '—'}</small>
                  </button>
                ))}
              </div>
              {!p.groups.length && (
                <div className={f.center}>
                  <Illustration scene="group" size={150} />
                  <p className={f.muted}>No saved groups yet.</p>
                </div>
              )}
              {p.onCreateGroup && (
                <Button variant="outline" size="sm" onPress={p.onCreateGroup}>
                  Create a group
                </Button>
              )}
            </section>
          )}

          {groupReady && (
            <section className={f.panel} key={step}>
              {step === 'amount' && <AmountStep p={p} />}
              {step === 'details' && <DetailsStep p={p} />}
              {step === 'paid' && <PaidStep p={p} memberById={memberById} />}
              {step === 'split' && <SplitStep p={p} memberById={memberById} />}
            </section>
          )}

          {stepError && groupReady && (
            <p className={f.notice} data-tone="warning" role="status">
              <EntityIcon value="phosphor:Info" size={18} />
              {stepError}
            </p>
          )}
          {p.error && (
            <p className={f.notice} data-tone="destructive" role="alert">
              <EntityIcon value="phosphor:WarningCircle" size={18} />
              {p.error}
            </p>
          )}
          {p.offline && (
            <StatusPill label="Offline · saves on this device and syncs later" tone="warning" />
          )}
          <div className={f.actions}>
            <Button
              variant="outline"
              disabled={p.saving}
              onPress={() => (stepIndex ? setStepIndex(stepIndex - 1) : p.onBack())}
            >
              {stepIndex ? 'Back' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={
                p.saving || !groupReady || (isLast ? Boolean(c.validation) : Boolean(stepError))
              }
            >
              {isLast
                ? p.saving
                  ? 'Saving…'
                  : p.mode === 'edit'
                    ? 'Review changes'
                    : 'Add expense'
                : `Next: ${composerStepLabels[composerSteps[stepIndex + 1]!]}`}
            </Button>
          </div>
        </div>

        <aside className={f.stack} aria-label="Split preview">
          <section className={f.panel}>
            <StepTitle
              icon="phosphor:ChartPieSlice"
              title="Live preview"
              hint="This expense only"
            />
            <StatusPill
              label={c.draft.allocation.label}
              tone={allocationTone(c.draft.allocation.tone)}
            />
            <div className={f.rows}>
              {c.participantIds.map((id) => {
                const member = memberById(id);
                return (
                  <div className={f.row} key={id}>
                    <PersonAvatar
                      name={member?.name ?? 'Member'}
                      url={member?.avatarUrl}
                      avatarId={member?.avatarId}
                      size={32}
                    />
                    <span className={f.rowCopy}>
                      <strong>{member?.name ?? 'Member'}</strong>
                    </span>
                    <span className={f.amount}>
                      {money(
                        c.draft.preview.find((row) => row.userId === id)?.amountMinor,
                        p.currency,
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {!c.participantIds.length && (
              <div className={f.center}>
                <Illustration scene="memberJoined" size={140} />
                <p className={f.muted}>Pick who shared this expense.</p>
              </div>
            )}
            <p className={f.muted}>
              Paid by{' '}
              {c.payerIds.map((id) => memberById(id)?.name ?? 'Member').join(', ') || 'nobody yet'}
            </p>
          </section>
        </aside>
      </form>
    </GroupPage>
  );
}

function StepTitle({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  const { tokens } = useTheme();
  return (
    <div className={f.stepTitle}>
      <IconTile tone="split" size={40}>
        <EntityIcon value={icon} size={22} color={tokens.split} />
      </IconTile>
      <div>
        <h2>{title}</h2>
        <p className={f.muted}>{hint}</p>
      </div>
    </div>
  );
}

function AmountStep({ p }: { p: GroupExpenseFormScreenProps }) {
  const c = p.composer;
  if (c.itemize)
    return (
      <>
        <StepTitle
          icon="phosphor:Receipt"
          title="What was on the bill?"
          hint={`The total is the sum of the items, in ${p.currency}`}
        />
        <Switch label="Itemize the bill" value onValueChange={c.setItemize} disabled={p.saving} />
        <LineItemsEditor
          rows={c.items}
          currency={p.currency}
          rowErrors={c.itemErrors}
          disabled={p.saving}
          onChange={c.setItems}
        />
      </>
    );
  return (
    <>
      <StepTitle icon="phosphor:Coins" title="How much was it?" hint={`In ${p.currency}`} />
      <Switch
        label="Itemize the bill"
        value={false}
        onValueChange={c.setItemize}
        disabled={p.saving}
      />
      <label className={f.amountWell}>
        <input
          className={f.bigInput}
          aria-label={`Amount in ${p.currency}`}
          inputMode="decimal"
          placeholder="0.00"
          autoFocus
          value={c.amount}
          disabled={p.saving}
          onChange={(event) => c.set('amount', event.currentTarget.value)}
        />
        <span className={f.muted}>{p.currency}</span>
      </label>
    </>
  );
}

function DetailsStep({ p }: { p: GroupExpenseFormScreenProps }) {
  const { tokens } = useTheme();
  const c = p.composer;
  return (
    <>
      <StepTitle icon="phosphor:Receipt" title="What was it for?" hint="Title, category and date" />
      <label className={f.field}>
        Title *
        <input
          className={f.input}
          value={c.title}
          maxLength={120}
          placeholder="Dinner, travel, groceries"
          disabled={p.saving}
          onChange={(event) => c.set('title', event.currentTarget.value)}
        />
      </label>
      {!!p.categories?.length && (
        <div className={f.field}>
          Category
          <div className={f.choices} role="radiogroup" aria-label="Category">
            {[
              { id: '', name: 'None', icon: 'phosphor:Tag', color: undefined },
              ...p.categories,
            ].map((category) => (
              <button
                key={category.id || 'none'}
                type="button"
                role="radio"
                className={f.choice}
                aria-checked={c.categoryId === category.id}
                onClick={() => c.set('categoryId', category.id)}
              >
                <Tile icon={category.icon ?? 'phosphor:Tag'} color={category.color} />
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={f.grid2}>
        <div className={f.field}>
          Date
          <DateTimePicker value={c.occurredAt} onChange={(value) => c.set('occurredAt', value)} />
        </div>
        {p.accountLocked ? (
          <p className={f.notice} data-tone="warning">
            <EntityIcon value="phosphor:Lock" size={18} color={tokens.foregroundMuted} />
            Stays on the account of the person who added it.
          </p>
        ) : (
          <div className={f.field}>
            Booked to account *
            <div className={f.choices} role="radiogroup" aria-label="Account">
              {p.accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  role="radio"
                  className={f.choice}
                  aria-checked={c.accountId === account.id}
                  onClick={() => c.set('accountId', account.id)}
                >
                  <EntityIcon value="phosphor:Wallet" size={18} color={tokens.income} />
                  {account.name}
                </button>
              ))}
            </div>
            {!p.accounts.length && (
              <p className={f.muted}>
                No account uses {p.currency}. Add one before saving a split.
              </p>
            )}
          </div>
        )}
      </div>
      <div className={f.grid2}>
        <label className={f.field}>
          Merchant (optional)
          <input
            className={f.input}
            value={c.merchant}
            placeholder="Where was it?"
            onChange={(event) => c.set('merchant', event.currentTarget.value)}
          />
        </label>
        <label className={f.field}>
          Note (optional)
          <input
            className={f.input}
            value={c.note}
            placeholder="Anything the group should know"
            onChange={(event) => c.set('note', event.currentTarget.value)}
          />
        </label>
      </div>
    </>
  );
}

function PaidStep({
  p,
  memberById,
}: {
  p: GroupExpenseFormScreenProps;
  memberById: (id: string) => GroupExpenseMemberOption | undefined;
}) {
  const { tokens } = useTheme();
  const c = p.composer;
  const multiple = c.payerIds.length > 1;
  if (!p.payerEditable) {
    const me = p.currentUserId ? memberById(p.currentUserId) : undefined;
    return (
      <>
        <StepTitle icon="phosphor:HandCoins" title="Who paid?" hint="You covered the bill" />
        <div className={f.center}>
          <Illustration scene="owedToYou" size={170} />
          <PersonAvatar
            name={me?.name ?? 'You'}
            url={me?.avatarUrl}
            avatarId={me?.avatarId}
            size={52}
          />
          <strong>
            {me?.name ?? 'You'} paid {money(c.draft.totalMinor, p.currency)}
          </strong>
          <StatusPill label="Paid in full" tone="income" />
        </div>
        <p className={f.muted}>
          New expenses are recorded with you as the payer. If someone else paid, save it and then
          choose Edit on the expense to change who paid or add several payers.
        </p>
      </>
    );
  }
  return (
    <>
      <StepTitle
        icon="phosphor:HandCoins"
        title="Who paid?"
        hint={multiple ? 'Enter what each person paid' : 'Pick the person who paid'}
      />
      <Switch
        label="Several people paid"
        value={multiple}
        onValueChange={(next) =>
          c.set(
            'payerIds',
            next
              ? c.payerIds
                  .concat(p.members.map((m) => m.userId).filter((id) => !c.payerIds.includes(id)))
                  .slice(0, 2)
              : c.payerIds.slice(0, 1),
          )
        }
      />
      <div className={f.rows} role={multiple ? 'group' : 'radiogroup'} aria-label="Who paid">
        {p.members.map((member) => {
          const selected = c.payerIds.includes(member.userId);
          return (
            <div className={f.row} key={member.userId}>
              <button
                type="button"
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={selected}
                className={f.choice}
                onClick={() =>
                  multiple ? c.togglePayer(member.userId) : c.set('payerIds', [member.userId])
                }
              >
                <PersonAvatar
                  name={member.name}
                  url={member.avatarUrl}
                  avatarId={member.avatarId}
                  size={30}
                />
                {member.name}
                {selected && (
                  <EntityIcon value="phosphor:CheckCircle" size={18} color={tokens.primary} />
                )}
              </button>
              <span className={f.rowCopy} />
              {multiple && selected && (
                <input
                  className={f.basisInput}
                  aria-label={`Amount ${member.name} paid`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={c.payerAmounts[member.userId] ?? ''}
                  onChange={(event) => c.setPayerAmount(member.userId, event.currentTarget.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      <StatusPill
        label={c.payerDraft.allocation.label}
        tone={allocationTone(c.payerDraft.allocation.tone)}
      />
    </>
  );
}

function SplitStep({
  p,
  memberById,
}: {
  p: GroupExpenseFormScreenProps;
  memberById: (id: string) => GroupExpenseMemberOption | undefined;
}) {
  const { tokens } = useTheme();
  const c = p.composer;
  const allSelected =
    p.members.length > 0 && p.members.every((m) => c.participantIds.includes(m.userId));
  return (
    <>
      <StepTitle
        icon="phosphor:ChartPieSlice"
        title="How is it split?"
        hint="Live preview per person"
      />
      <div className={f.methods} role="radiogroup" aria-label="Split method">
        {methods.map((method) => {
          const selected = c.method === method.value;
          return (
            <button
              key={method.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={f.method}
              onClick={() => c.setMethod(method.value)}
            >
              <IconTile tone="split" solid={selected} size={34}>
                <EntityIcon
                  value={method.icon}
                  size={18}
                  color={selected ? tokens.primaryForeground : tokens.split}
                />
              </IconTile>
              <strong>{method.title}</strong>
              <small>{method.description}</small>
            </button>
          );
        })}
      </div>
      <div className={f.stepTitle}>
        <strong style={{ flex: 1 }}>
          {c.participantIds.length} of {p.members.length} sharing
        </strong>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => c.setAllParticipants(allSelected ? [] : p.members.map((m) => m.userId))}
        >
          {allSelected ? 'Clear all' : 'Everyone'}
        </Button>
      </div>
      <div className={f.people}>
        {p.members.map((member) => {
          const included = c.participantIds.includes(member.userId);
          return (
            <button
              key={member.userId}
              type="button"
              role="checkbox"
              aria-checked={included}
              aria-label={`Include ${member.name}`}
              className={f.person}
              onClick={() => c.toggleParticipant(member.userId, !included)}
            >
              <PersonAvatar
                name={member.name}
                url={member.avatarUrl}
                avatarId={member.avatarId}
                size={44}
              />
              <span>{member.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
      {c.method === 'itemized' && (
        <div className={f.field}>
          Who had each item?
          <LineItemsEditor
            rows={c.items}
            currency={p.currency}
            rowErrors={c.itemErrors}
            disabled={p.saving}
            onChange={c.setItems}
            people={c.participantIds.map((id) => ({
              userId: id,
              name: memberById(id)?.name ?? 'Member',
              avatarId: memberById(id)?.avatarId,
              avatarUrl: memberById(id)?.avatarUrl,
            }))}
          />
        </div>
      )}
      <StatusPill label={c.draft.allocation.label} tone={allocationTone(c.draft.allocation.tone)} />
      {c.method !== 'equal' && c.method !== 'itemized' && (
        <div className={f.rows}>
          {c.participantIds.map((id) => {
            const member = memberById(id);
            const name = member?.name ?? 'Member';
            const label = `${c.method === 'exact' ? 'Amount' : c.method === 'percentage' ? 'Percent' : 'Shares'} for ${name}`;
            return (
              <label className={f.row} key={id}>
                <PersonAvatar
                  name={name}
                  url={member?.avatarUrl}
                  avatarId={member?.avatarId}
                  size={32}
                />
                <span className={f.rowCopy}>
                  <strong>{name}</strong>
                </span>
                <input
                  className={f.basisInput}
                  aria-label={label}
                  inputMode={c.method === 'shares' ? 'numeric' : 'decimal'}
                  placeholder={
                    c.method === 'percentage' ? '33.33' : c.method === 'shares' ? '1' : '0.00'
                  }
                  value={c.basis[id] ?? ''}
                  onChange={(event) => c.setBasis(id, event.currentTarget.value)}
                />
                {c.method === 'percentage' && <span>%</span>}
              </label>
            );
          })}
        </div>
      )}
    </>
  );
}
