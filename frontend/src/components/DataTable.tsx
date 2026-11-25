/**
 * Sortable, filterable and virtualized table (TanStack Table + TanStack Virtual). Only the visible rows
 * are rendered, so tens of thousands of order lines stay fluid (RNF-02).
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cx, Input } from './ui';

export interface Column<T> {
  id: string;
  header: string;
  value: (row: T) => string | number | null;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

const ROW_HEIGHT = 37;

export function DataTable<T>({
  data,
  columns,
  height = 420,
  searchable = true,
}: {
  data: T[];
  columns: Column<T>[];
  height?: number;
  searchable?: boolean;
}) {
  const { t, f } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState('');
  const columnDefs = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        accessorFn: c.value,
        cell: (ctx) => (c.render ? c.render(ctx.row.original) : (ctx.getValue() as ReactNode)),
        meta: { align: c.align },
      })),
    [columns],
  );
  const table = useReactTable({
    data,
    columns: columnDefs,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('common.search')}
              aria-label={t('common.search')}
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted">{t('common.rows', { n: f.int(rows.length) })}</span>
        </div>
      )}
      <div ref={scrollRef} className="overflow-auto rounded-xl border border-line" style={{ height }}>
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align;
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      className={cx(
                        'sticky top-0 z-10 bg-glass-strong px-3 py-2 text-xs font-medium text-muted backdrop-blur',
                        align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      <button
                        className="inline-flex items-center gap-1 hover:text-fg"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' && <ArrowUp className="size-3" aria-hidden />}
                        {sorted === 'desc' && <ArrowDown className="size-3" aria-hidden />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && (
              <tr aria-hidden>
                <td style={{ height: padTop }} colSpan={columns.length} />
              </tr>
            )}
            {items.map((item) => {
              const row = rows[item.index];
              return (
                <tr key={row.id} className="border-t border-line" style={{ height: ROW_HEIGHT }}>
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
                    return (
                      <td
                        key={cell.id}
                        className={cx(
                          'px-3 py-2 whitespace-nowrap',
                          align === 'right' && 'text-right tabular-nums',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {padBottom > 0 && (
              <tr aria-hidden>
                <td style={{ height: padBottom }} colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
