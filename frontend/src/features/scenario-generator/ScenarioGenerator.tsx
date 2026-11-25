/** Synthetic scenario generator (CU-02, RF-05) with the S1-S3 templates of section 6.2. */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles } from 'lucide-react';
import { Button, Card, Field, Input, Notice } from '@/components/ui';
import { useGenerateScenario } from '@/hooks/queries';
import { useI18n } from '@/i18n';
import { useUi } from '@/app/store';

const schema = z.object({
  name: z.string().trim().min(1),
  n_orders: z.number().int().min(1).max(5000),
  mean_lines: z.number().int().min(1).max(500),
  max_units: z.number().int().min(1).max(10_000),
  seed: z.number().int().min(0),
});
type Values = z.infer<typeof schema>;

const PRESETS: Values[] = [
  { name: 'S1 Pequeño', n_orders: 50, mean_lines: 100, max_units: 500, seed: 101 },
  { name: 'S2 Mediano', n_orders: 200, mean_lines: 100, max_units: 500, seed: 102 },
  { name: 'S3 Enunciado', n_orders: 500, mean_lines: 100, max_units: 500, seed: 103 },
];

export function ScenarioGenerator() {
  const { t, f } = useI18n();
  const generate = useGenerateScenario();
  const setScenarioId = useUi((s) => s.setScenarioId);
  const [done, setDone] = useState<{ name: string; n: number } | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: PRESETS[1],
  });
  const num = { valueAsNumber: true };

  const onSubmit = handleSubmit(async (values) => {
    const scenario = await generate.mutateAsync(values);
    setScenarioId(scenario.scenario_id);
    setDone({ name: scenario.name, n: scenario.n_orders });
  });

  return (
    <Card title={t('gen.title')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-xs text-muted">{t('gen.hint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t('gen.presets')}:</span>
          {PRESETS.map((p) => (
            <Button key={p.name} type="button" size="sm" variant="secondary" onClick={() => reset(p)}>
              {p.name.split(' ')[0]} · {p.n_orders}
            </Button>
          ))}
        </div>
        <Field label={t('gen.name')} htmlFor="gen-name">
          <Input id="gen-name" aria-invalid={!!formState.errors.name} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('gen.nOrders')} htmlFor="gen-orders">
            <Input
              id="gen-orders"
              type="number"
              min={1}
              aria-invalid={!!formState.errors.n_orders}
              {...register('n_orders', num)}
            />
          </Field>
          <Field label={t('gen.meanLines')} htmlFor="gen-lines">
            <Input
              id="gen-lines"
              type="number"
              min={1}
              aria-invalid={!!formState.errors.mean_lines}
              {...register('mean_lines', num)}
            />
          </Field>
          <Field label={t('gen.maxUnits')} htmlFor="gen-units">
            <Input
              id="gen-units"
              type="number"
              min={1}
              aria-invalid={!!formState.errors.max_units}
              {...register('max_units', num)}
            />
          </Field>
          <Field label={t('gen.seed')} htmlFor="gen-seed">
            <Input
              id="gen-seed"
              type="number"
              min={0}
              aria-invalid={!!formState.errors.seed}
              {...register('seed', num)}
            />
          </Field>
        </div>
        <div>
          <Button
            type="submit"
            variant="primary"
            icon={<Sparkles className="size-4" />}
            loading={generate.isPending}
          >
            {t('gen.submit')}
          </Button>
        </div>
        {done && <Notice tone="ok">{t('gen.done', { name: done.name, n: f.int(done.n) })}</Notice>}
        {generate.isError && <Notice tone="danger">{t('common.error')}</Notice>}
      </form>
    </Card>
  );
}
