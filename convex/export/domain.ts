const forbiddenKeys: Record<string, true> = {
  token: true,
  secret: true,
  accessToken: true,
  refreshToken: true,
  session: true,
};

export function safeExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !forbiddenKeys[key]));
}

export function exportTables(
  tables: Record<string, readonly Record<string, unknown>[]>,
): Record<string, Record<string, unknown>[]> {
  return Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.map(safeExportRow)]),
  );
}
