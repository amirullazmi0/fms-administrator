'use client';
// Peta monitoring untuk manajemen / owner: posisi semua unit dengan warna status operasional (dari
// MDT / supervisor), ringkasan jumlah unit per status, daftar unit + delay code + operator; dan heat
// map jalan (titik panas / kepadatan) dari ritase.
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { HEAT_GRADIENT } from '@/components/fleet/HeatMap';
import type { HeatMode } from '@/components/fleet/HeatMap';
import { MONITOR_TONE } from '@/components/fleet/MonitorMap';
import type { MonitorTone, MonitorUnit } from '@/components/fleet/MonitorMap';
import { useData } from '@/provider/StreamProvider';
import { Empty } from '@/components/ui/misc';
import { SimpleSelect } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { addDays, dateKey, displayName, fmtDuration, lastHeard, STALE_MS } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { cn } from '@/lib/utils';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { HeatmapReport, UnitStatusLog } from '@/types/fleet';

const MonitorMap = dynamic(() => import('@/components/fleet/MonitorMap'), { ssr: false });
const HeatMap = dynamic(() => import('@/components/fleet/HeatMap'), { ssr: false });

type Tab = 'live' | 'heat';
type Range = 'today' | '7d' | '30d';
// Daftar unit: yang butuh perhatian di atas.
const PRIORITY: MonitorTone[] = [
    'breakdown',
    'standby_unplanned',
    'standby_planned',
    'working',
    'none',
    'offline',
];
const ORDER: MonitorTone[] = [
    'working',
    'standby_planned',
    'standby_unplanned',
    'breakdown',
    'none',
    'offline',
];

export default function MonitoringView() {
    const [tab, setTab] = useState<Tab>('live');
    return (
        <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-3 p-3 md:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-xl font-semibold">Peta monitoring</h1>
                    <p className="m-0 text-sm text-muted-foreground">
                        Posisi & status operasional seluruh unit, dan titik panas jalan angkut.
                    </p>
                </div>
                <ToggleGroup
                    type="single"
                    value={tab}
                    onValueChange={(v) => v && setTab(v as Tab)}
                    aria-label="Tampilan peta"
                >
                    <ToggleGroupItem value="live">Live unit</ToggleGroupItem>
                    <ToggleGroupItem value="heat">Heat map jalan</ToggleGroupItem>
                </ToggleGroup>
            </div>
            {tab === 'live' ? <LiveTab /> : <HeatTab />}
        </div>
    );
}

function LiveTab() {
    const { devices, sites, routes } = useData();
    const now = useNow(30000);
    const [selected, setSelected] = useState<string | null>(null);
    const [filter, setFilter] = useState<MonitorTone | null>(null);
    const current = useQueryApiRequest<GlobalApiResponse<UnitStatusLog[]>>({
        key: 'unit-status-current',
        config: { errorNotification: false },
        options: { refetchInterval: 60000 },
    });

    // Operator per unit dari penugasan shift aktif (routes.onDuty).
    const driverOf = useMemo(() => {
        const m = new Map<string, string>();
        for (const r of routes)
            for (const d of r.onDuty ?? []) if (d.phase !== 'done') m.set(d.imei, d.driverName);
        return m;
    }, [routes]);

    const units = useMemo<MonitorUnit[]>(() => {
        const st = new Map((current.data?.data ?? []).map((l) => [l.imei, l]));
        return Object.values(devices)
            .filter((d) => d.pos)
            .map((d) => {
                const log = st.get(d.imei);
                const offline = !d.online && now - lastHeard(d) > STALE_MS;
                const tone: MonitorTone = offline
                    ? 'offline'
                    : ((log?.category as MonitorTone | null) ??
                      (log?.status === 'working'
                          ? 'working'
                          : log?.status === 'breakdown'
                            ? 'breakdown'
                            : log
                              ? 'standby_unplanned'
                              : 'none'));
                return {
                    imei: d.imei,
                    label: d.plate || displayName(d),
                    lat: d.pos!.lat,
                    lng: d.pos!.lng,
                    angle: d.pos!.angle,
                    tone,
                    status: offline
                        ? `Offline · ${fmtDuration(now - lastHeard(d))} lalu`
                        : (log?.delayName ?? MONITOR_TONE[tone].label),
                    driver: log?.driverName ?? driverOf.get(d.imei) ?? null,
                };
            });
    }, [devices, current.data, now, driverOf]);

    const counts = useMemo(() => {
        const c = Object.fromEntries(ORDER.map((t) => [t, 0])) as Record<MonitorTone, number>;
        for (const u of units) c[u.tone]++;
        return c;
    }, [units]);
    const shown = filter ? units.filter((u) => u.tone === filter) : units;

    return (
        <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {ORDER.map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setFilter(filter === t ? null : t)}
                        className={cn(
                            'flex flex-col items-start rounded-xl border bg-card px-3 py-2 text-left transition hover:bg-muted',
                            filter === t && 'ring-2 ring-ring',
                        )}
                    >
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <i
                                className="size-2.5 rounded-full"
                                style={{ background: MONITOR_TONE[t].color }}
                            />
                            {MONITOR_TONE[t].label}
                        </span>
                        <span className="text-2xl font-bold tabular-nums">{counts[t]}</span>
                    </button>
                ))}
            </div>
            <div className="grid min-h-[480px] flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <MonitorMap
                    units={shown}
                    sites={sites}
                    selected={selected}
                    onSelect={setSelected}
                />
                <section className="flex max-h-[70vh] min-h-0 flex-col rounded-xl border bg-card">
                    <h2 className="m-0 border-b px-4 py-3 text-sm font-semibold">
                        Unit {filter ? `· ${MONITOR_TONE[filter].label}` : ''} ({shown.length})
                    </h2>
                    {shown.length === 0 ? (
                        <Empty className="p-4">Tidak ada unit.</Empty>
                    ) : (
                        <ul className="m-0 flex min-h-0 list-none flex-col overflow-y-auto p-2">
                            {shown
                                .slice()
                                .sort(
                                    (a, b) =>
                                        PRIORITY.indexOf(a.tone) - PRIORITY.indexOf(b.tone) ||
                                        a.label.localeCompare(b.label),
                                )
                                .map((u) => (
                                    <li key={u.imei}>
                                        <button
                                            type="button"
                                            onClick={() => setSelected(u.imei)}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-muted',
                                                selected === u.imei && 'bg-muted',
                                            )}
                                        >
                                            <i
                                                className="size-3 shrink-0 rounded-full"
                                                style={{ background: MONITOR_TONE[u.tone].color }}
                                            />
                                            <span className="min-w-0 flex-1">
                                                <b className="block truncate">{u.label}</b>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {u.status}
                                                    {u.driver ? ` · ${u.driver}` : ''}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}

function HeatTab() {
    const { routes, sites } = useData();
    const [range, setRange] = useState<Range>('7d');
    const [mode, setMode] = useState<HeatMode>('slow');
    const [route, setRoute] = useState('');
    const queries = useMemo(() => {
        const today = dateKey();
        const from = range === 'today' ? today : addDays(today, range === '7d' ? -6 : -29);
        return { from: new Date(`${from}T00:00:00`).getTime(), ...(route ? { route } : {}) };
    }, [range, route]);
    const report = useQueryApiRequest<GlobalApiResponse<HeatmapReport>>({
        key: 'reports-heatmap',
        queries,
        options: { staleTime: 60000 },
    });
    const rep = report.data?.data;
    const shownSites = useMemo(() => {
        const r = routes.find((x) => x.id === route);
        return r
            ? sites.filter(
                  (s) => s.id === r.loadingId || (r.unloadingIds ?? [r.unloadingId]).includes(s.id),
              )
            : sites;
    }, [routes, sites, route]);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                    type="single"
                    value={mode}
                    onValueChange={(v) => v && setMode(v as HeatMode)}
                    aria-label="Mode"
                >
                    <ToggleGroupItem value="slow">Titik panas (lambat)</ToggleGroupItem>
                    <ToggleGroupItem value="traffic">Kepadatan lalu lintas</ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={(v) => v && setRange(v as Range)}
                    aria-label="Periode"
                >
                    <ToggleGroupItem value="today">Hari ini</ToggleGroupItem>
                    <ToggleGroupItem value="7d">7 hari</ToggleGroupItem>
                    <ToggleGroupItem value="30d">30 hari</ToggleGroupItem>
                </ToggleGroup>
                <SimpleSelect
                    value={route}
                    onChange={(v) => setRoute(v === 'all' ? '' : v)}
                    placeholder="Semua rute"
                    aria-label="Rute"
                    className="w-52"
                    options={[
                        { value: 'all', label: 'Semua rute' },
                        ...routes.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                />
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {mode === 'slow' ? 'Lancar' : 'Sepi'}
                    <i
                        className="h-2.5 w-36 rounded-full"
                        style={{
                            background: `linear-gradient(to right, ${HEAT_GRADIENT.map(([at, c]) => `${c} ${at * 100}%`).join(', ')})`,
                        }}
                    />
                    {mode === 'slow' ? 'Lambat & sering dilalui' : 'Padat'}
                </span>
            </div>
            <div className="min-h-[480px] flex-1">
                {report.isLoading ? (
                    <Empty>Memuat heat map…</Empty>
                ) : rep && rep.cells.length === 0 ? (
                    <Empty>Belum ada ritase selesai pada periode ini.</Empty>
                ) : (
                    <HeatMap cells={rep?.cells ?? []} shocks={[]} sites={shownSites} mode={mode} />
                )}
            </div>
        </>
    );
}
