import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { excelSerialToIso, parseCsv, readXlsx, sheetForPrompt } from '../../convex/ai/spreadsheet';
import {
  detectDateFormat,
  mapImportRows,
  parseAmount,
  parseDate,
} from '../../convex/ai/importDomain';

/** A minimal but real .xlsx: shared strings, an inline string, a date-styled cell, numbers. */
function workbook() {
  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook xmlns:r="r"><sheets><sheet name="Bank &amp; Card" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      '<sst><si><t>Date</t></si><si><t>Description</t></si><si><t>Amount</t></si><si><r><t>Coffee </t></r><r><t>&amp; cake</t></r></si><si><t>Salary</t></si></sst>',
    ),
    'xl/styles.xml': strToU8(
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="14"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      [
        '<worksheet><sheetData>',
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>',
        '<row r="2"><c r="A2" s="1"><v>46027</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>-4.5</v></c></row>',
        '<row r="4"><c r="A4" s="2"><v>46029</v></c><c r="B4" t="s"><v>4</v></c><c r="C4"><v>2500</v></c></row>',
        '<row r="5"><c r="A5" t="inlineStr"><is><t>not a date</t></is></c><c r="C5"><v>10</v></c></row>',
        '</sheetData></worksheet>',
      ].join(''),
    ),
    'xl/worksheets/sheet2.xml': strToU8(
      '<worksheet><sheetData><row r="1"><c r="B1" t="str"><v>hello</v></c><c r="C1" t="b"><v>1</v></c></row></sheetData></worksheet>',
    ),
  });
}

describe('spreadsheet readers', () => {
  it('reads every sheet of an xlsx, with shared/rich/inline strings and date-styled cells', () => {
    const [bank, notes] = readXlsx(workbook());
    expect(bank!.name).toBe('Bank & Card');
    expect(bank!.rows).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-01-05', 'Coffee & cake', '-4.5'],
      [],
      ['2026-01-07', 'Salary', '2500'],
      ['not a date', '', '10'],
    ]);
    expect(notes).toMatchObject({ name: 'Notes', rows: [['', 'hello', 'TRUE']] });
  });

  it('refuses broken workbooks', () => {
    expect(() => readXlsx(zipSync({ 'hello.txt': strToU8('hi') }))).toThrow('INVALID_SPREADSHEET');
    expect(() => readXlsx(new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('parses CSV with quotes, embedded newlines, BOM and a detected delimiter', () => {
    expect(parseCsv('﻿a,b\n"x, y","say ""hi"""\n"multi\nline",2\n').rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', '2'],
    ]);
    expect(parseCsv('date;amount\r\n01/02/2026;12,50\r\n').rows).toEqual([
      ['date', 'amount'],
      ['01/02/2026', '12,50'],
    ]);
  });

  it('converts Excel serials across the 1900 leap-year bug', () => {
    expect(excelSerialToIso(1)).toBe('1900-01-01');
    expect(excelSerialToIso(61)).toBe('1900-03-01');
    expect(excelSerialToIso(46027)).toBe('2026-01-05');
    expect(excelSerialToIso(-3)).toBeNull();
  });

  it('renders sheets for the prompt within a budget and says how many rows are left out', () => {
    const sheet = parseCsv(
      ['h1,h2', ...Array.from({ length: 50 }, (_, i) => `row${i},${i}`)].join('\n'),
    );
    const text = sheetForPrompt(sheet, 60);
    expect(text.startsWith('h1,h2\nrow0,0')).toBe(true);
    expect(text).toMatch(/51 rows in total; \d+ not shown/);
    expect(sheetForPrompt(parseCsv('a,b\n1,2'), 1000)).toBe('a,b\n1,2');
  });
});

describe('import parsing', () => {
  it('reads amounts exactly in many notations', () => {
    expect(parseAmount('₹1,23,456.50', 'INR')).toEqual({ minor: 12_345_650n, negative: false });
    expect(parseAmount('(45.00)', 'USD')).toEqual({ minor: 4500n, negative: true });
    expect(parseAmount('1.234,56 €', 'EUR')).toEqual({ minor: 123_456n, negative: false });
    expect(parseAmount('12,5', 'EUR')).toEqual({ minor: 1250n, negative: false });
    expect(parseAmount('1,234', 'USD')).toEqual({ minor: 123_400n, negative: false });
    expect(parseAmount('45.10-', 'USD')).toEqual({ minor: 4510n, negative: true });
    expect(parseAmount('300 CR', 'INR')).toEqual({
      minor: 30_000n,
      negative: false,
      hint: 'income',
    });
    expect(parseAmount('USD -7', 'USD')).toEqual({ minor: 700n, negative: true });
    expect(parseAmount('1500', 'JPY')).toEqual({ minor: 1500n, negative: false });
    expect(parseAmount('1.005', 'USD')).toBeNull();
    expect(parseAmount('abc', 'USD')).toBeNull();
    expect(parseAmount('', 'USD')).toBeNull();
  });

  it('reads dates in common formats and detects day/month order from the data', () => {
    const noon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12);
    expect(parseDate('2026-01-05', 'DMY')).toBe(noon(2026, 1, 5));
    expect(parseDate('05/01/2026', 'DMY')).toBe(noon(2026, 1, 5));
    expect(parseDate('01/05/2026', 'MDY')).toBe(noon(2026, 1, 5));
    expect(parseDate('5-Jan-26', 'DMY')).toBe(noon(2026, 1, 5));
    expect(parseDate('Jan 5, 2026', 'DMY')).toBe(noon(2026, 1, 5));
    expect(parseDate('46027', 'DMY')).toBe(noon(2026, 1, 5));
    expect(parseDate('31/02/2026', 'DMY')).toBeNull();
    expect(detectDateFormat(['01/02/2026', '25/02/2026'], true)).toBe('DMY');
    expect(detectDateFormat(['02/25/2026'], false)).toBe('MDY');
    expect(detectDateFormat(['01/02/2026'], true)).toBe('MDY');
  });

  it('maps a bank sheet to transactions and reports rows it could not read', () => {
    const [bank] = readXlsx(workbook());
    const result = mapImportRows(
      bank!,
      { date: 'date', description: 'Description', amount: 'C' },
      { currency: 'USD' },
    );
    expect(result.rows).toEqual([
      {
        row: 2,
        occurredAt: Date.UTC(2026, 0, 5, 12),
        type: 'expense',
        amountMinor: '450',
        title: 'Coffee & cake',
      },
      {
        row: 4,
        occurredAt: Date.UTC(2026, 0, 7, 12),
        type: 'income',
        amountMinor: '250000',
        title: 'Salary',
      },
    ]);
    expect(result.skipped).toEqual([{ row: 5, reason: 'Unreadable date “not a date”' }]);
  });

  it('supports debit/credit columns, a type column and all-positive expense exports', () => {
    const debitCredit = parseCsv(
      'Date,Narration,Withdrawal,Deposit,Category\n02/01/2026,Rent,15000,,Housing\n03/01/2026,Pay,,50000,\n04/01/2026,Zero,0,,\n',
    );
    const mapped = mapImportRows(
      debitCredit,
      {
        date: 'Date',
        description: 'Narration',
        debit: 'Withdrawal',
        credit: 'Deposit',
        category: 'Category',
      },
      { currency: 'INR' },
    );
    expect(mapped.rows.map((row) => [row.type, row.amountMinor, row.category])).toEqual([
      ['expense', '1500000', 'Housing'],
      ['income', '5000000', undefined],
    ]);
    expect(mapped.skipped).toEqual([{ row: 4, reason: 'No readable amount' }]);

    const typed = parseCsv(
      'when,what,amt,kind\n2026-01-01,Refund,20,Credit\n2026-01-02,Lunch,12,Debit\n',
    );
    expect(
      mapImportRows(
        typed,
        { date: 'when', description: 'what', amount: 'amt', type: 'kind' },
        { currency: 'USD' },
      ).rows.map((row) => row.type),
    ).toEqual(['income', 'expense']);

    const positives = parseCsv('d,a\n2026-01-01,5\n2026-01-02,7\n');
    expect(
      mapImportRows(positives, { date: 'd', amount: 'a' }, { currency: 'USD' }).rows.every(
        (row) => row.type === 'expense' && row.title === 'Imported transaction',
      ),
    ).toBe(true);
  });

  it('rejects a mapping that names a missing column', () => {
    const sheet = parseCsv('Date,Amount\n2026-01-01,5\n');
    expect(() =>
      mapImportRows(sheet, { date: 'Day', amount: 'Amount' }, { currency: 'USD' }),
    ).toThrow('IMPORT_COLUMN_NOT_FOUND:date');
    expect(() => mapImportRows(sheet, { date: 'Date' }, { currency: 'USD' })).toThrow(
      'IMPORT_COLUMN_NOT_FOUND:amount',
    );
  });
});
