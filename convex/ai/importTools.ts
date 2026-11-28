/**
 * Bulk import from a spreadsheet attachment. The model names the columns; the whole file is
 * parsed here (`importDomain`), category names are matched to the user's categories, and the
 * result becomes one confirmation card. Confirming inserts every row through the normal
 * transaction mutation (each with its own idempotency key, so a retried confirm adds nothing).
 */
import { api, internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import { readSheets } from './attachmentContent';
import { mapImportRows, MAX_IMPORT_ROWS, type ImportMapping } from './importDomain';
import { formatMinor, shortDate } from './present';
import { oneOf, requiredStr, s, str, ToolArgError } from './toolArgs';
import { propose, type FinaiTool } from './toolContext';

/** Compact stored row: [occurredAt, "i"|"e", amountMinor, title, categoryId?, merchant?, note?]. */
type StoredRow = [number, 'i' | 'e', string, string, string?, string?, string?];

const column = (description: string) => s.string(description);

export const importTools: FinaiTool[] = [
  {
    name: 'propose_import_transactions',
    description:
      'Import every row of a spreadsheet attachment (.xlsx/.csv) as transactions. Name the columns exactly as in the sheet header (or by letter). The server reads all rows itself, so never list rows yourself. The user must press Confirm. Ask which account to use if it is unclear.',
    parameters: s.object(
      {
        attachmentId: s.string('The attachment id shown with the file.'),
        sheet: s.string('Sheet name (default: the first sheet).'),
        headerRow: s.integer(
          '1-based row with the column headers (default: first non-empty).',
          1,
          1000,
        ),
        date: column('Date column.'),
        description: column('Description / narration column.'),
        amount: column('Signed amount column (when there is one amount column).'),
        debit: column('Money-out column (when debits and credits are separate).'),
        credit: column('Money-in column (when debits and credits are separate).'),
        type: column('Column saying income/expense, credit/debit or CR/DR.'),
        category: column('Category column (matched to the user’s categories by name).'),
        merchant: column('Merchant / payee column.'),
        note: column('Notes column.'),
        dateFormat: s.enumOf('Order of day and month in dates. Default auto-detect.', [
          'auto',
          'DMY',
          'MDY',
          'YMD',
        ]),
        amountSign: s.enumOf(
          'How to read a single amount column without a type column. Default auto (negatives are expenses when any exist, else all expenses).',
          ['auto', 'negativeIsExpense', 'allExpense', 'allIncome'],
        ),
        accountId: s.string('Account id from list_accounts. Default: the user’s default account.'),
      },
      ['attachmentId', 'date'],
    ),
    progress: { stage: 'working', label: 'Reading the spreadsheet…' },
    run: async (ctx, args) => {
      const attachmentId = requiredStr(args, 'attachmentId', 64);
      const [file] = await ctx.run
        .runQuery(internal.ai.attachments.forModel, {
          userId: ctx.userId,
          ids: [attachmentId as Id<'finaiAttachments'>],
        })
        .catch(() => []);
      if (!file) throw new ToolArgError('ATTACHMENT_NOT_FOUND');
      if (file.kind !== 'spreadsheet') throw new ToolArgError('NOT_A_SPREADSHEET');
      if (!file.storageId) throw new ToolArgError('ATTACHMENT_DELETED');
      const blob = await ctx.run.storage.get(file.storageId);
      if (!blob) throw new ToolArgError('ATTACHMENT_DELETED');
      let sheets;
      try {
        sheets = readSheets(new Uint8Array(await blob.arrayBuffer()), file.name);
      } catch {
        throw new ToolArgError('UNREADABLE_SPREADSHEET');
      }
      const wanted = str(args, 'sheet', 120);
      const sheet = wanted
        ? sheets.find((entry) => entry.name.toLowerCase() === wanted.toLowerCase())
        : sheets[0];
      if (!sheet) throw new ToolArgError('SHEET_NOT_FOUND');
      if (sheet.truncated)
        return {
          data: {
            error: 'SPREADSHEET_TRUNCATED',
            parsedRows: sheet.rows.length,
            note: 'This sheet reached a parser limit, so its total row count is unknown. No import was proposed.',
          },
        };

      const account = await chooseAccount(ctx.run, str(args, 'accountId', 64));
      const mapping: ImportMapping = {
        date: requiredStr(args, 'date', 120),
        ...(typeof args.headerRow === 'number' ? { headerRow: Math.round(args.headerRow) } : {}),
      };
      for (const field of [
        'description',
        'amount',
        'debit',
        'credit',
        'type',
        'category',
        'merchant',
        'note',
      ] as const) {
        const value = str(args, field, 120);
        if (value) mapping[field] = value;
      }
      const dateFormat = oneOf(args, 'dateFormat', ['auto', 'DMY', 'MDY', 'YMD'] as const);
      if (dateFormat) mapping.dateFormat = dateFormat;
      const amountSign = oneOf(args, 'amountSign', [
        'auto',
        'negativeIsExpense',
        'allExpense',
        'allIncome',
      ] as const);
      if (amountSign) mapping.amountSign = amountSign;

      let result: ReturnType<typeof mapImportRows>;
      try {
        result = mapImportRows(sheet, mapping, {
          currency: account.currency,
          preferMdy: account.currency === 'USD',
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : 'INVALID_MAPPING';
        if (code.startsWith('IMPORT_COLUMN_NOT_FOUND'))
          return {
            data: {
              error: code,
              headers: sheetHeaders(sheet, mapping.headerRow),
              note: 'Use the exact header names listed here.',
            },
          };
        throw error;
      }
      if (!result.rows.length)
        return {
          data: {
            error: 'NOTHING_TO_IMPORT',
            headers: result.headers,
            skipped: result.skipped.slice(0, 10),
          },
        };

      // Category names → the user's categories (case-insensitive); unknown names are left empty.
      const categories = await ctx.run.runQuery(api.categories.queries.list, {});
      const byName = new Map(
        categories.map((row) => [row.name.trim().toLowerCase(), String(row._id)]),
      );
      const unmatched = new Set<string>();
      let income = 0n;
      let expense = 0n;
      const rows: StoredRow[] = result.rows.map((row) => {
        const categoryId = row.category ? byName.get(row.category.trim().toLowerCase()) : undefined;
        if (row.category && !categoryId) unmatched.add(row.category);
        if (row.type === 'income') income += BigInt(row.amountMinor);
        else expense += BigInt(row.amountMinor);
        return [
          row.occurredAt,
          row.type === 'income' ? 'i' : 'e',
          row.amountMinor,
          row.title,
          categoryId,
          row.merchant,
          row.note,
        ];
      });
      const dates = result.rows.map((row) => row.occurredAt);
      const from = shortDate(Math.min(...dates), ctx.timeZone);
      const to = shortDate(Math.max(...dates), ctx.timeZone);
      const lines = [
        { label: 'Account', value: account.name },
        { label: 'Transactions', value: String(rows.length) },
        { label: 'Dates', value: from === to ? from : `${from} – ${to}` },
        ...(expense ? [{ label: 'Money out', value: formatMinor(expense, account.currency) }] : []),
        ...(income ? [{ label: 'Money in', value: formatMinor(income, account.currency) }] : []),
        ...(result.skipped.length
          ? [{ label: 'Skipped rows', value: String(result.skipped.length) }]
          : []),
        ...(result.overflow
          ? [
              {
                label: 'Not imported',
                value: `${result.overflow} (limit ${MAX_IMPORT_ROWS} per import)`,
              },
            ]
          : []),
      ];
      const proposal = await propose(ctx, {
        kind: 'transaction.import',
        title: `Import ${rows.length} transactions from “${file.name}”`,
        payload: { accountId: account.id, currency: account.currency, rows },
        lines,
      });
      return {
        ...proposal,
        data: {
          ...(proposal.data as Record<string, unknown>),
          count: rows.length,
          sample: result.rows.slice(0, 3).map((row) => ({
            row: row.row,
            date: shortDate(row.occurredAt, ctx.timeZone),
            type: row.type,
            amount: formatMinor(BigInt(row.amountMinor), account.currency),
            title: row.title,
          })),
          skipped: result.skipped.slice(0, 10),
          unmatchedCategories: [...unmatched].slice(0, 10),
          note: 'Mention skipped rows and unmatched categories (imported without a category) briefly.',
        },
      };
    },
  },
];

function sheetHeaders(sheet: { rows: string[][] }, headerRow?: number) {
  const index = headerRow ? headerRow - 1 : sheet.rows.findIndex((row) => row.some(Boolean));
  return (sheet.rows[index] ?? []).filter(Boolean).slice(0, 40);
}

async function chooseAccount(ctx: ActionCtx, preferred?: string) {
  const [accounts, me] = await Promise.all([
    ctx.runQuery(api.accounts.queries.list, {}),
    ctx.runQuery(api.users.queries.current, {}),
  ]);
  const chosen =
    (preferred && accounts.find((account) => String(account.id) === preferred)) ||
    accounts.find((account) => String(account.id) === String(me?.defaultAccountId)) ||
    accounts[0];
  if (preferred && String(chosen?.id) !== preferred) throw new ToolArgError('ACCOUNT_NOT_FOUND');
  if (!chosen) throw new ToolArgError('NO_ACCOUNT');
  return { id: String(chosen.id), name: chosen.name, currency: chosen.currency };
}

/** Runs a confirmed import: one transaction per stored row, idempotent per row. */
export async function executeImport(
  ctx: ActionCtx,
  payload: Record<string, unknown>,
  clientMutationId: string,
): Promise<string> {
  const accountId = payload.accountId as Id<'accounts'>;
  const currency = String(payload.currency);
  const rows = Array.isArray(payload.rows) ? (payload.rows as StoredRow[]) : [];
  if (!accountId || !rows.length || rows.length > MAX_IMPORT_ROWS)
    throw new Error('INVALID_ACTION_PAYLOAD');
  let created = 0;
  for (const [index, row] of rows.entries()) {
    const [occurredAt, type, amountMinor, title, categoryId, merchant, note] = row;
    if (!/^\d{1,19}$/.test(String(amountMinor))) throw new Error('INVALID_ACTION_PAYLOAD');
    await ctx.runMutation(api.transactions.mutations.create, {
      accountId,
      type: type === 'i' ? 'income' : 'expense',
      amountMinor: BigInt(amountMinor),
      currency,
      title: String(title).slice(0, 120) || 'Imported transaction',
      ...(categoryId ? { categoryId: categoryId as Id<'categories'> } : {}),
      ...(merchant ? { merchant } : {}),
      ...(note ? { note } : {}),
      occurredAt: Number(occurredAt),
      clientMutationId: `${clientMutationId}:${index}`,
    });
    created++;
  }
  return `${created} transactions`;
}
