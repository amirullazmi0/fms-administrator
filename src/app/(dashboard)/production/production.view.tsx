'use client';
// Produksi per jam untuk manajemen: ritase & tonase per jam vs target (sementara / final),
// cycle time per tahap, status unit, dan kesegaran data dari blank spot.
import { useEffect, useMemo, useState } from 'react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import {
    FreshnessPanel,
    HourlyPanel,
    StagesPanel,
    UnitStatusPanel,
} from '@/components/fleet/Production';
import { useData } from '@/provider/StreamProvider';
import { addDays, dateKey, fmtDate, fmtNum } from '@/lib/format';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { Freshness, HourlyReport, StageReport, UnitStatusLog } from '@/types/fleet';

type R<T> = GlobalApiResponse<T>;
type Day = 'today' | 'yesterday' | 'custom';

export default function ProductionView() {
    const { routes } = useData();
    const { setStats } = useLayout();
    const [day, setDay] = useState<Day>('today');
    const [custom, setCustom] = useState(dateKey());
    const [route, setRoute] = useState('');

    const key = day === 'today' ? dateKey() : day === 'yesterday' ? addDays(dateKey(), -1) : custom;
    const queries = useMemo(() => {
        const from = new Date(`${key}T00:00:00`).getTime();
        // Hari ini: to kosong = sampai sekarang (dihitung server). Hari lalu: sampai akhir hari itu.
        const to = key === dateKey() ? undefined : new Date(`${key}T23:59:59.999`).getTime();
        return { from, ...(to ? { to } : {}), ...(route ? { route } : {}) };
    }, [key, route]);

    const quiet = { errorNotification: false };
    const hourly = useQueryApiRequest<R<HourlyReport>>({
        key: 'reports-hourly',
        queries,
        config: quiet,
        options: { refetchInterval: 60000 },
    });
    const stages = useQueryApiRequest<R<StageReport>>({
        key: 'reports-stages',
        queries,
        config: quiet,
    });
    const fresh = useQueryApiRequest<R<Freshness[]>>({
        key: 'reports-freshness',
        config: quiet,
        options: { refetchInterval: 60000 },
    });
    const current = useQueryApiRequest<R<UnitStatusLog[]>>({
        key: 'unit-status-current',
        config: quiet,
        options: { refetchInterval: 60000 },
    });

    const total = hourly.data?.data?.total;
    useEffect(() => {
        setStats(
            total ? (
                <>
                    <HeaderStat label="Ritase" value={fmtNum(total.rit)} />
                    <HeaderStat label="Tonase" value={`${fmtNum(total.ton)} t`} />
                    {total.achievement != null && (
                        <HeaderStat
                            label="Pencapaian"
                            value={`${fmtNum(total.achievement)}%`}
                            tone={total.achievement < 100 ? 'danger' : undefined}
                        />
                    )}
                </>
            ) : null,
        );
        return () => setStats(null);
    }, [total, setStats]);

    return (
        <div className="flex flex-col gap-4 p-3 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                    type="single"
                    value={day}
                    onValueChange={(v) => v && setDay(v as Day)}
                    aria-label="Hari"
                >
                    <ToggleGroupItem value="today">Hari ini</ToggleGroupItem>
                    <ToggleGroupItem value="yesterday">Kemarin</ToggleGroupItem>
                    <ToggleGroupItem value="custom">Tanggal</ToggleGroupItem>
                </ToggleGroup>
                {day === 'custom' && (
                    <Input
                        type="date"
                        value={custom}
                        max={dateKey()}
                        onChange={(e) => setCustom(e.target.value)}
                        className="w-auto"
                    />
                )}
                <Combobox
                    value={route}
                    onChange={setRoute}
                    options={[
                        { value: '', label: 'Semua rute / fleet' },
                        ...routes.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                    placeholder="Semua rute / fleet"
                    className="w-56"
                />
                <span className="text-sm text-muted-foreground">{fmtDate(key)}</span>
            </div>

            <HourlyPanel report={hourly.data?.data ?? null} loading={hourly.isLoading} />
            <StagesPanel report={stages.data?.data ?? null} />
            <div className="grid gap-4 xl:grid-cols-2">
                <UnitStatusPanel list={current.data?.data ?? []} />
                <FreshnessPanel list={fresh.data?.data ?? []} />
            </div>
        </div>
    );
}
