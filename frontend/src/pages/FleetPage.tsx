/** Fleet screen (CU-04, RF-06): capacity, average speed, cost per km and optional driving-hours limit. */
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Save, Truck } from 'lucide-react';
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Spinner, TableWrap } from '@/components/ui';
import { useCurrentFleet, useFleets, useSaveFleet } from '@/hooks/queries';
import { useI18n } from '@/i18n';
import { useQueryClient } from '@tanstack/react-query';

const TEST_FLEET = {
  capacity_units: 60_000,
  speed_kmh: 70,
  cost_per_km: 1.1,
  limit: false,
  max_driving_hours: 9,
};

/** ERR-08: capacity, speed and cost must be positive; the error message key is shown under the field. */
const schema = z.object({
  capacity_units: z
    .number({ error: 'fleet.err.positive' })
    .int('fleet.err.integer')
    .positive('fleet.err.positive'),
  speed_kmh: z.number({ error: 'fleet.err.positive' }).positive('fleet.err.positive'),
  cost_per_km: z.number({ error: 'fleet.err.positive' }).positive('fleet.err.positive'),
  limit: z.boolean(),
  max_driving_hours: z.number({ error: 'fleet.err.positive' }).positive('fleet.err.positive'),
});
type FormValues = z.infer<typeof schema>;

export function FleetPage() {
  const { t, f } = useI18n();
  const qc = useQueryClient();
  const current = useCurrentFleet();
  const fleets = useFleets();
  const save = useSaveFleet();
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: TEST_FLEET });
  const { register, handleSubmit, reset, control, formState } = form;
  const limit = useWatch({ control, name: 'limit' });

  useEffect(() => {
    if (current.data) {
      reset({
        capacity_units: current.data.capacity_units,
        speed_kmh: current.data.speed_kmh,
        cost_per_km: current.data.cost_per_km,
        limit: current.data.max_driving_hours != null,
        max_driving_hours: current.data.max_driving_hours ?? 9,
      });
    }
  }, [current.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    await save.mutateAsync({
      capacity_units: values.capacity_units,
      speed_kmh: values.speed_kmh,
      cost_per_km: values.cost_per_km,
      max_driving_hours: values.limit ? values.max_driving_hours : null,
    });
    await qc.invalidateQueries({ queryKey: ['fleet'] });
    setSaved(true);
  });

  const err = (name: keyof FormValues) => {
    const message = formState.errors[name]?.message;
    return message ? t(message as Parameters<typeof t>[0]) : undefined;
  };
  const num = { valueAsNumber: true, onChange: () => setSaved(false) };

  return (
    <>
      <PageHeader title={t('fleet.title')} subtitle={t('fleet.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title={t('fleet.title')}>
          {current.isLoading ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
              <Field
                label={t('fleet.capacity')}
                hint={t('fleet.capacityHint')}
                error={err('capacity_units')}
                htmlFor="capacity"
              >
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  step={1}
                  suffix={t('unit.units')}
                  aria-invalid={!!formState.errors.capacity_units}
                  {...register('capacity_units', num)}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('fleet.speed')} error={err('speed_kmh')} htmlFor="speed">
                  <Input
                    id="speed"
                    type="number"
                    min={1}
                    step="any"
                    suffix="km/h"
                    aria-invalid={!!formState.errors.speed_kmh}
                    {...register('speed_kmh', num)}
                  />
                </Field>
                <Field label={t('fleet.cost')} error={err('cost_per_km')} htmlFor="cost">
                  <Input
                    id="cost"
                    type="number"
                    min={0.01}
                    step="0.01"
                    suffix="€/km"
                    aria-invalid={!!formState.errors.cost_per_km}
                    {...register('cost_per_km', num)}
                  />
                </Field>
              </div>
              <div className="glass flex flex-col gap-3 rounded-xl p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[#3AA7FF]"
                    {...register('limit', { onChange: () => setSaved(false) })}
                  />
                  <span>
                    <span className="font-medium text-fg">{t('fleet.drivingLimit')}</span>
                    <span className="block text-xs text-muted">{t('fleet.drivingLimitHint')}</span>
                  </span>
                </label>
                {limit && (
                  <Field label={t('fleet.maxHours')} error={err('max_driving_hours')} htmlFor="hours">
                    <Input
                      id="hours"
                      type="number"
                      min={1}
                      step="0.5"
                      suffix="h"
                      aria-invalid={!!formState.errors.max_driving_hours}
                      {...register('max_driving_hours', num)}
                    />
                  </Field>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Save className="size-4" />}
                  loading={save.isPending}
                >
                  {t('fleet.save')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset(TEST_FLEET);
                    setSaved(false);
                  }}
                >
                  {t('fleet.preset')}
                </Button>
              </div>
              {saved && <Notice tone="ok">{t('fleet.saved')}</Notice>}
            </form>
          )}
        </Card>

        <Card title={t('fleet.history')}>
          {fleets.isLoading ? (
            <Spinner label={t('common.loading')} />
          ) : (
            <TableWrap maxHeight={420}>
              <thead>
                <tr>
                  <th>{t('data.col.id')}</th>
                  <th className="text-right">{t('fleet.capacity')}</th>
                  <th className="text-right">{t('fleet.speed')}</th>
                  <th className="text-right">{t('fleet.cost')}</th>
                  <th className="text-right">{t('fleet.maxHours')}</th>
                </tr>
              </thead>
              <tbody>
                {fleets.data?.map((fleet) => (
                  <tr key={fleet.fleet_id}>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Truck className="size-4 text-muted" aria-hidden />
                        {fleet.fleet_id}
                        {fleet.fleet_id === current.data?.fleet_id && (
                          <Badge tone="accent">
                            <CheckCircle2 className="size-3" aria-hidden />
                            {t('fleet.current')}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{f.int(fleet.capacity_units)}</td>
                    <td className="text-right tabular-nums">{f.int(fleet.speed_kmh)} km/h</td>
                    <td className="text-right tabular-nums">{f.dec(fleet.cost_per_km)} €</td>
                    <td className="text-right tabular-nums">
                      {fleet.max_driving_hours == null
                        ? t('fleet.noLimit')
                        : f.hours(fleet.max_driving_hours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
