/**
 * Small, dependency-light readers for FinAI attachments: CSV/TSV text and .xlsx workbooks
 * (a zip of XML, unpacked with fflate). Output is plain string grids so the same code feeds the
 * model prompt and the bulk-import tool. Dates in .xlsx cells formatted as dates come out as
 * `YYYY-MM-DD`; everything else is the cell's text.
 *
 * Limits keep hostile files cheap: at most `MAX_UNZIPPED_BYTES` of XML is inflated (zip bombs
 * are refused before inflating), and grids are cut at `MAX_ROWS` × `MAX_COLUMNS`.
 */
import { unzipSync } from 'fflate';

export const MAX_ROWS = 5_000;
export const MAX_COLUMNS = 60;
const MAX_UNZIPPED_BYTES = 60 * 1024 * 1024;
const MAX_SHEETS = 12;

export type Sheet = { name: string; rows: string[][]; truncated: boolean };

// ---------- CSV ----------

/** The most likely delimiter in the first lines: comma, semicolon, tab or pipe. */
function detectDelimiter(text: string): string {
  const candidates = [',', ';', '\t', '|'];
  const records = new Map(candidates.map((delimiter) => [delimiter, [] as number[]]));
  const counts = new Map(candidates.map((delimiter) => [delimiter, 0]));
  let quoted = false;
  let fieldStart = true;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') index++;
        else quoted = false;
      }
    } else if (char === '"' && fieldStart) quoted = true;
    else if (char === '\n' || char === '\r') {
      for (const delimiter of candidates) records.get(delimiter)!.push(counts.get(delimiter)! + 1);
      for (const delimiter of candidates) counts.set(delimiter, 0);
      fieldStart = true;
      if (char === '\r' && text[index + 1] === '\n') index++;
    } else if (counts.has(char)) {
      counts.set(char, counts.get(char)! + 1);
      fieldStart = true;
    } else fieldStart = false;
  }
  if (candidates.some((delimiter) => counts.get(delimiter)! > 0))
    for (const delimiter of candidates) records.get(delimiter)!.push(counts.get(delimiter)! + 1);
  let best = ',';
  let bestScore = 0;
  for (const delimiter of candidates) {
    const frequencies = new Map<number, number>();
    for (const width of records.get(delimiter)!) {
      if (width > 1) frequencies.set(width, (frequencies.get(width) ?? 0) + 1);
    }
    const score = Math.max(0, ...frequencies.values()) * 100 + [...frequencies.values()].reduce((a, b) => a + b, 0);
    if (score > bestScore) { best = delimiter; bestScore = score; }
  }
  return best;
}

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines in quotes), delimiter auto-detected. */
export function parseCsv(input: string, name = 'Sheet1'): Sheet {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let truncated = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row.slice(0, MAX_COLUMNS));
    if (row.length > MAX_COLUMNS) truncated = true;
    row = [];
  };
  for (let index = 0; index < text.length; index++) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = false;
      } else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      endRow();
    } else field += char;
  }
  if (rows.length < MAX_ROWS && (field !== '' || row.length)) endRow();
  return { name, rows: rows.map((cells) => cells.map((cell) => cell.trim())), truncated };
}

// ---------- XLSX ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** All `<t>` text inside a string item (rich text runs joined, phonetic runs skipped). */
function itemText(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const match of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
    out += decodeXml(match[1]!);
  return out;
}

function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** "AB12" → 27 (zero-based column index). */
function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47]);

/** Which cell style indexes (`s="…"`) are dates, from styles.xml. */
function dateStyles(stylesXml: string | undefined): Set<number> {
  const result = new Set<number>();
  if (!stylesXml) return result;
  const customDates = new Set<number>();
  for (const match of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(match[0], 'numFmtId'));
    const code = decodeXml(attr(match[0], 'formatCode') ?? '')
      .replace(/"[^"]*"|\[[^\]]*\]/g, '')
      .toLowerCase();
    // Day or year parts mean a date (a bare "m" could be minutes).
    if (/[dy]/.test(code)) customDates.add(id);
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? '';
  let index = 0;
  for (const match of cellXfs.matchAll(/<xf\b[^>]*?(?:\/>|>)/g)) {
    const id = Number(attr(match[0], 'numFmtId') ?? '0');
    if (BUILTIN_DATE_FORMATS.has(id) || customDates.has(id)) result.add(index);
    index++;
  }
  return result;
}

/** Excel serial day (1900 system) → `YYYY-MM-DD`. */
export function excelSerialToIso(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2_958_465) return null;
  if (date1904)
    return new Date(Date.UTC(1904, 0, 1) + Math.floor(serial) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  const days = Math.floor(serial) - (serial >= 60 ? 25_569 : 25_568);
  return new Date(days * 86_400_000).toISOString().slice(0, 10);
}

function sheetRows(xml: string, shared: string[], dates: Set<number>, date1904: boolean) {
  const rows: string[][] = [];
  let truncated = false;
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    const body = rowMatch[2];
    if (!body) continue;
    const declared = Number(attr(` ${rowMatch[1] ?? ''}`, 'r'));
    // Keep blank rows between data so row numbers in messages match the sheet.
    if (Number.isFinite(declared) && declared > rows.length + 1)
      while (rows.length < declared - 1 && rows.length < MAX_ROWS) rows.push([]);
    const cells: string[] = [];
    let next = 0;
    for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = ` ${cellMatch[1] ?? ''}`;
      const ref = attr(tag, 'r');
      const column = ref ? columnIndex(ref) : next;
      next = column + 1;
      if (column >= MAX_COLUMNS) {
        truncated = true;
        continue;
      }
      const inner = cellMatch[2] ?? '';
      const type = attr(tag, 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = itemText(inner);
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'str' || type === 'e') value = decodeXml(raw ?? '');
      else if (raw !== undefined) {
        const style = Number(attr(tag, 's') ?? '-1');
        const number = Number(raw);
        value = dates.has(style) ? (excelSerialToIso(number, date1904) ?? raw) : raw;
      }
      while (cells.length < column) cells.push('');
      cells[column] = value.trim();
    }
    rows.push(cells);
  }
  while (rows.length && rows[rows.length - 1]!.every((cell) => cell === '')) rows.pop();
  return { rows, truncated };
}

/** Reads every worksheet of an .xlsx workbook (first `MAX_SHEETS`). Throws on a broken file. */
export function readXlsx(bytes: Uint8Array): Sheet[] {
  let inflated = 0;
  const files = unzipSync(bytes, {
    filter: (file) => {
      const wanted =
        file.name === 'xl/workbook.xml' ||
        file.name === 'xl/_rels/workbook.xml.rels' ||
        file.name === 'xl/sharedStrings.xml' ||
        file.name === 'xl/styles.xml' ||
        /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name);
      if (!wanted) return false;
      inflated += file.originalSize;
      if (inflated > MAX_UNZIPPED_BYTES) throw new Error('SPREADSHEET_TOO_LARGE');
      return true;
    },
  });
  const text = (name: string) => (files[name] ? new TextDecoder().decode(files[name]) : undefined);
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new Error('INVALID_SPREADSHEET');
  const shared = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (match) => itemText(match[1]!),
  );
  const date1904 = /<workbookPr\b[^>]*\bdate1904="(?:1|true)"/i.test(workbook);
  const rels = new Map<string, string>();
  for (const match of (text('xl/_rels/workbook.xml.rels') ?? '').matchAll(
    /<Relationship\b[^>]*>/g,
  )) {
    const id = attr(match[0], 'Id');
    const target = attr(match[0], 'Target');
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  const sheets: Sheet[] = [];
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    if (sheets.length >= MAX_SHEETS) break;
    const name = decodeXml(attr(match[0], 'name') ?? `Sheet${sheets.length + 1}`);
    const relId = attr(match[0], 'r:id');
    const path = (relId && rels.get(relId)) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const xml = text(path);
    if (!xml) continue;
    const { rows, truncated } = sheetRows(xml, shared, dates, date1904);
    sheets.push({ name, rows, truncated });
  }
  if (!sheets.length) throw new Error('INVALID_SPREADSHEET');
  return sheets;
}

// ---------- Prompt rendering ----------

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * A sheet as compact CSV for the model, within `maxChars`: the header and as many rows as fit,
 * then a note with the total so the model knows to use the import tool for the full data.
 */
export function sheetForPrompt(sheet: Sheet, maxChars: number): string {
  const budget = Math.max(0, maxChars);
  if (!budget) return '';
  const rows = sheet.rows.filter((row) => row.some((cell) => cell !== ''));
  const lines = rows.map((row) => row.map(csvCell).join(','));
  const disclosure = sheet.truncated
    ? '… parser limit reached; additional data may be missing'
    : sheet.omittedSheets
      ? `… ${sheet.omittedSheets} additional sheets not parsed`
      : '… rows omitted; use import tool for complete data';
  let output = '';
  let shown = 0;
  for (const line of lines) {
    const next = output ? `${output}\n${line}` : line;
    if (next.length + (shown + 1 < lines.length || sheet.truncated || sheet.omittedSheets ? disclosure.length : 0) > budget)
      break;
    output = next;
    shown++;
  }
  if (shown === lines.length && !sheet.truncated && !sheet.omittedSheets) return output;
  if (!output) return disclosure.slice(0, budget);
  return `${output.slice(0, Math.max(0, budget - disclosure.length))}${disclosure}`.slice(0, budget);
}
