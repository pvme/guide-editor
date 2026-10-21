export function resolveSpreadsheetReference(spreadsheet, target) {
  if (!target.includes('!')) {
    return Object.hasOwn(spreadsheet?.cell_aliases ?? {}, target)
      ? spreadsheet.cell_aliases[target]
      : undefined;
  }
  const address = /^(.+)!([A-Za-z]+)(\d+)$/.exec(target);
  if (!address) return undefined;
  const [, sheet, column, row] = address;
  const sheets = spreadsheet?.cells ?? {};
  if (!Object.hasOwn(sheets, sheet) || !Object.hasOwn(sheets[sheet] ?? {}, column)) return undefined;
  const rows = sheets[sheet][column];
  return Object.hasOwn(rows ?? {}, row) ? rows[row] : undefined;
}
