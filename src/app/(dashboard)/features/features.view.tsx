'use client';
// Fitur: switch features on/off and edit their config (stored in the features table).
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Play, Square } from 'lucide-react';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { ago } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/checkbox';
import { Empty, KV, Note } from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { Feature, SimulationConfig, SimulationStatus } from '@/types/feature';

type UpdateBody = {
    __params: { key: string };
    enabled?: boolean;
    config?: Record<string, unknown>;
};

export default function FeaturesView() {
    const { setStats } = useLayout();
    const features = useQueryApiRequest<GlobalApiResponse<Feature[]>>({ key: 'features' });
    const list = features.data?.data ?? [];
    const enabled = list.filter((f) => f.enabled).length;

    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Fitur" value={list.length} />
                <HeaderStat label="Aktif" value={enabled} />
            </>,
        );
    }, [setStats, list.length, enabled]);
    useEffect(() => () => setStats(null), [setStats]);

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 md:p-6">
            <p className="m-0 text-sm text-muted-foreground">
                Fitur yang dapat diaktifkan/dinonaktifkan tanpa deploy ulang. Setelan disimpan di
                database.
            </p>
            {features.isLoading && <Empty>Memuat…</Empty>}
            {list.map((f) =>
                f.key === 'simulation' ? (
                    <SimulationCard key={`${f.key}-${f.updated_at}`} feature={f} />
                ) : (
                    <FeatureCard key={f.key} feature={f} />
                ),
            )}
        </div>
    );
}

function useUpdateFeature() {
    const toast = useToast();
    const update = useMutationApiRequest<GlobalApiResponse<Feature>, UpdateBody>({
        key: 'features-update',
        config: SILENT,
    });
    return async (body: UpdateBody, done: string) => {
        try {
            await update.mutateAsync(body);
            toast({ title: done });
            return true;
        } catch (err) {
            toast({ title: 'Gagal menyimpan fitur', body: errText(err), level: 'crit' });
            return false;
        }
    };
}

function FeatureHead({
    feature,
    onToggle,
    busy,
}: {
    feature: Feature;
    onToggle: (v: boolean) => void;
    busy: boolean;
}) {
    const can = useCan();
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                    <b className="text-[15px]">{feature.name}</b>
                    <code className="text-xs text-muted-foreground">{feature.key}</code>
                    {feature.enabled ? (
                        <Badge variant="success">Aktif</Badge>
                    ) : (
                        <Badge variant="muted">Mati</Badge>
                    )}
                </span>
                {feature.description && (
                    <span className="text-sm text-muted-foreground">{feature.description}</span>
                )}
                <span className="text-xs text-muted-foreground">
                    Diubah {ago(feature.updated_at)}
                </span>
            </div>
            <Switch
                checked={feature.enabled}
                disabled={busy || !can(P.featureUpdate)}
                onCheckedChange={onToggle}
                aria-label={`${feature.enabled ? 'Nonaktifkan' : 'Aktifkan'} ${feature.name}`}
            />
        </div>
    );
}

function FeatureCard({ feature }: { feature: Feature }) {
    const update = useUpdateFeature();
    const [busy, setBusy] = useState(false);
    const toggle = async (v: boolean) => {
        setBusy(true);
        await update(
            { __params: { key: feature.key }, enabled: v },
            `${feature.name} ${v ? 'diaktifkan' : 'dinonaktifkan'}`,
        );
        setBusy(false);
    };
    return (
        <Card className="px-5">
            <FeatureHead feature={feature} onToggle={(v) => void toggle(v)} busy={busy} />
        </Card>
    );
}

function SimulationCard({ feature }: { feature: Feature }) {
    const can = useCan();
    const toast = useToast();
    const update = useUpdateFeature();
    const cfg = feature.config as Partial<SimulationConfig>;
    const [form, setForm] = useState<SimulationConfig>({
        devices: Number(cfg.devices ?? 2),
        interval: Number(cfg.interval ?? 3),
        loop: Boolean(cfg.loop),
    });
    const [busy, setBusy] = useState(false);
    // The card remounts (key = updated_at) when the saved config changes, so the form re-reads it.

    const sim = useQueryApiRequest<GlobalApiResponse<SimulationStatus>>({
        key: 'simulation',
        config: { errorNotification: false },
        options: { enabled: can(P.simulationRun) },
    });
    const start = useMutationApiRequest<GlobalApiResponse<SimulationStatus>, object>({
        key: 'simulation-start',
        config: SILENT,
    });
    const stop = useMutationApiRequest<GlobalApiResponse<SimulationStatus>, object>({
        key: 'simulation-stop',
        config: SILENT,
    });
    const s = sim.data?.data;
    const editable = can(P.featureUpdate);
    const invalid =
        form.devices < 1 || form.devices > 50 || form.interval < 1 || form.interval > 60;

    const toggle = async (v: boolean) => {
        setBusy(true);
        await update(
            { __params: { key: feature.key }, enabled: v },
            v ? 'Simulasi diaktifkan' : 'Simulasi dinonaktifkan',
        );
        setBusy(false);
    };
    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (invalid) return;
        setBusy(true);
        await update(
            { __params: { key: feature.key }, config: { ...form } },
            'Setelan simulasi disimpan',
        );
        setBusy(false);
    };
    const run = async () => {
        setBusy(true);
        try {
            if (s?.running) {
                await stop.mutateAsync({});
                toast({ title: 'Simulasi dihentikan', level: 'warn' });
            } else {
                await start.mutateAsync({});
                toast({
                    title: 'Simulasi berjalan',
                    body: `${form.devices} unit simulasi terhubung ke server.`,
                });
            }
        } catch (err) {
            toast({ title: 'Gagal', body: errText(err), level: 'crit' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="gap-5 px-5">
            <FeatureHead feature={feature} onToggle={(v) => void toggle(v)} busy={busy} />
            <form className="flex flex-col gap-4 border-t pt-4" onSubmit={(e) => void save(e)}>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Jumlah unit" hint="1–50">
                        <Input
                            type="number"
                            min={1}
                            max={50}
                            value={form.devices}
                            disabled={!editable}
                            onChange={(e) => setForm({ ...form, devices: Number(e.target.value) })}
                        />
                    </Field>
                    <Field label="Kirim data tiap (detik)" hint="1–60">
                        <Input
                            type="number"
                            min={1}
                            max={60}
                            value={form.interval}
                            disabled={!editable}
                            onChange={(e) => setForm({ ...form, interval: Number(e.target.value) })}
                        />
                    </Field>
                </div>
                <Label className="justify-between rounded-lg border p-3">
                    <span className="flex flex-col gap-1">
                        <span>Unit tanpa tugas keliling Jakarta</span>
                        <span className="text-xs font-normal text-muted-foreground">
                            Bila nonaktif, unit yang tidak ditugaskan di shift aktif tetap parkir.
                        </span>
                    </span>
                    <Switch
                        checked={form.loop}
                        disabled={!editable}
                        onCheckedChange={(v) => setForm({ ...form, loop: v })}
                    />
                </Label>
                <Note tone="info">
                    Setelan baru berlaku saat simulasi dijalankan kembali. Unit yang ditugaskan di
                    shift aktif melakukan hauling dan return sesuai rutenya.
                </Note>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {s && (
                        <KV
                            className="min-w-56 flex-1"
                            rows={[
                                [
                                    'Status',
                                    s.running ? (
                                        <Badge variant="success">Berjalan · {s.devices} unit</Badge>
                                    ) : (
                                        <Badge variant="muted">Berhenti</Badge>
                                    ),
                                ],
                                ...(s.running && s.started_at
                                    ? ([['Mulai', ago(s.started_at)]] as [string, string][])
                                    : []),
                            ]}
                        />
                    )}
                    <div className="flex gap-2">
                        {editable && (
                            <Button type="submit" variant="outline" disabled={busy || invalid}>
                                Simpan setelan
                            </Button>
                        )}
                        {can(P.simulationRun) && (
                            <Button
                                type="button"
                                variant={s?.running ? 'destructive' : 'default'}
                                disabled={busy || !feature.enabled}
                                onClick={() => void run()}
                            >
                                {s?.running ? (
                                    <>
                                        <Square /> Hentikan
                                    </>
                                ) : (
                                    <>
                                        <Play /> Jalankan
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </Card>
    );
}
