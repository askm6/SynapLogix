/** File import (CU-01, RF-01 to RF-04): read, validate row by row, show errors or import. */
import { useId, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { Badge, Button, Card, Field, Input, Notice, Select, Tabs, TableWrap } from '@/components/ui';
import {
  useDestinations,
  useImportDestinations,
  useImportOrders,
  useImportProducts,
  useProducts,
} from '@/hooks/queries';
import { useI18n, type MessageKey } from '@/i18n';
import type { RowError } from '@/types/api';
import type { Destination, Order, OrderLine, Product } from '@/types/entities';
import { useUi } from '@/app/store';
import { readTable } from './readFile';
import {
  COLUMNS,
  validateDestinations,
  validateOrderLines,
  validateOrders,
  validateProducts,
} from './validation';

type Kind = 'products' | 'destinations' | 'orders';
type Pending =
  | { kind: 'products'; rows: Product[] }
  | { kind: 'destinations'; rows: Destination[] }
  | { kind: 'orders'; orders: Omit<Order, 'scenario_id'>[]; lines: OrderLine[] };

const MAX_ERRORS_SHOWN = 500;

function FilePicker({
  label,
  onFile,
  fileName,
}: {
  label: string;
  onFile: (file: File) => void;
  fileName?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <label
        htmlFor={id}
        className="glass flex cursor-pointer items-center gap-3 rounded-xl border-dashed px-4 py-4 text-sm text-muted hover:text-fg"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <FileUp className="size-5 text-accent-ink" aria-hidden />
        <span className="truncate">{fileName ?? t('import.drop')}</span>
      </label>
      <input
        id={id}
        type="file"
        accept=".csv,.txt,.xlsx,.xls"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </Field>
  );
}

export function ImportPanel() {
  const { t, f } = useI18n();
  const products = useProducts();
  const destinations = useDestinations();
  const importProducts = useImportProducts();
  const importDestinations = useImportDestinations();
  const importOrders = useImportOrders();
  const setScenarioId = useUi((s) => s.setScenarioId);

  const [kind, setKind] = useState<Kind>('products');
  const [files, setFiles] = useState<{ main?: File; lines?: File }>({});
  const [errors, setErrors] = useState<RowError[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [readError, setReadError] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioType, setScenarioType] = useState<'real' | 'training'>('real');

  const resetState = () => {
    setErrors([]);
    setPending(null);
    setReadError(false);
    setSuccess(null);
  };

  const changeKind = (k: Kind) => {
    setKind(k);
    setFiles({});
    resetState();
  };

  /** Validate whatever files are loaded; orders need both the orders file and the lines file. */
  async function validate(next: { main?: File; lines?: File }) {
    resetState();
    try {
      if (!next.main) return;
      const main = await readTable(next.main);
      if (kind === 'products') {
        const result = validateProducts(main.header, main.rows);
        setErrors(result.errors);
        if (!result.errors.length) setPending({ kind, rows: result.rows });
      } else if (kind === 'destinations') {
        const result = validateDestinations(main.header, main.rows);
        setErrors(result.errors);
        if (!result.errors.length) setPending({ kind, rows: result.rows });
      } else {
        const orders = validateOrders(main.header, main.rows, {
          destinationIds: new Set(destinations.data?.map((d) => d.destination_id)),
        });
        let lineErrors: RowError[] = [];
        let lines: OrderLine[] = [];
        if (next.lines) {
          const linesFile = await readTable(next.lines);
          const result = validateOrderLines(linesFile.header, linesFile.rows, {
            orderIds: new Set(main.rows.map((r) => (r.order_id ?? '').trim())),
            productIds: new Set(products.data?.map((p) => p.product_id)),
          });
          lineErrors = result.errors.map((e) => ({ ...e, field: `order_lines.${e.field}` }));
          lines = result.rows;
        }
        const all = [...orders.errors, ...lineErrors];
        setErrors(all);
        if (!all.length && next.lines) setPending({ kind, orders: orders.rows, lines });
      }
    } catch {
      setReadError(true);
    }
  }

  async function submit() {
    if (!pending) return;
    if (pending.kind === 'products') setSuccess((await importProducts.mutateAsync(pending.rows)).imported);
    else if (pending.kind === 'destinations')
      setSuccess((await importDestinations.mutateAsync(pending.rows)).imported);
    else {
      const result = await importOrders.mutateAsync({
        scenario: { name: scenarioName.trim() || files.main?.name || 'Importado', type: scenarioType },
        orders: pending.orders,
        order_lines: pending.lines,
      });
      if (result.scenario) setScenarioId(result.scenario.scenario_id);
      setSuccess(result.imported);
    }
    setPending(null);
  }

  const expected = kind === 'orders' ? [COLUMNS.orders, COLUMNS.order_lines] : [COLUMNS[kind]];
  const validRows =
    pending?.kind === 'orders' ? pending.orders.length + pending.lines.length : (pending?.rows.length ?? 0);
  const busy = importProducts.isPending || importDestinations.isPending || importOrders.isPending;

  return (
    <Card title={t('import.title')}>
      <div className="flex flex-col gap-5">
        <p className="text-xs text-muted">{t('import.hint')}</p>
        <Tabs<Kind>
          label={t('import.dataset')}
          value={kind}
          onChange={changeKind}
          items={[
            { value: 'products', label: t('import.ds.products') },
            { value: 'destinations', label: t('import.ds.destinations') },
            { value: 'orders', label: t('import.ds.orders') },
          ]}
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{t('import.expected')}</span>
          {expected.map((cols) => (
            <code key={cols[0]} className="glass block overflow-x-auto rounded-lg px-3 py-2 text-xs text-fg">
              {cols.join(';')}
            </code>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FilePicker
            label={kind === 'orders' ? t('import.fileOrders') : t('import.file')}
            fileName={files.main?.name}
            onFile={(file) => {
              const next = { ...files, main: file };
              setFiles(next);
              void validate(next);
            }}
          />
          {kind === 'orders' && (
            <FilePicker
              label={t('import.fileLines')}
              fileName={files.lines?.name}
              onFile={(file) => {
                const next = { ...files, lines: file };
                setFiles(next);
                void validate(next);
              }}
            />
          )}
        </div>

        {kind === 'orders' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('import.scenarioName')} htmlFor="imp-name">
              <Input id="imp-name" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} />
            </Field>
            <Field label={t('import.scenarioType')} htmlFor="imp-type">
              <Select
                id="imp-type"
                value={scenarioType}
                onChange={(e) => setScenarioType(e.target.value as 'real' | 'training')}
              >
                <option value="real">{t('data.type.real')}</option>
                <option value="training">{t('data.type.training')}</option>
              </Select>
            </Field>
          </div>
        )}

        {readError && <Notice tone="danger">{t('import.readError')}</Notice>}
        {success !== null && <Notice tone="ok">{t('import.success', { n: f.int(success) })}</Notice>}

        {pending && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="ok">{t('import.valid', { n: f.int(validRows) })}</Badge>
            <Button variant="primary" icon={<Upload className="size-4" />} onClick={submit} loading={busy}>
              {t('import.submit')}
            </Button>
          </div>
        )}

        {errors.length > 0 && (
          <div className="flex flex-col gap-3">
            <Notice tone="danger">{t('import.invalid', { n: f.int(errors.length) })}</Notice>
            <TableWrap maxHeight={320}>
              <thead>
                <tr>
                  <th className="text-right">{t('import.col.row')}</th>
                  <th>{t('import.col.field')}</th>
                  <th>{t('import.col.reason')}</th>
                  <th>{t('import.col.value')}</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
                  <tr key={i}>
                    <td className="text-right tabular-nums">{e.row}</td>
                    <td>
                      <code className="text-xs">{e.field}</code>
                    </td>
                    <td className="text-danger">{t(`import.err.${e.code}` as MessageKey)}</td>
                    <td className="text-muted">{e.value ?? t('common.none')}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        )}
      </div>
    </Card>
  );
}
