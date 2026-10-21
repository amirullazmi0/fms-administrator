'use client';
// Dashboard laporan (administrator): KPI, tren harian, kondisi armada, ranking rute/operator/unit,
// sebaran shift, lalu tabel ritase per rute / operator / unit / shift / hari. Klik baris untuk detail.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    RotateCcw,
    Route as RouteIcon,
    Truck,
    UserRound,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import TripTable from '@/components/fleet/TripTable';
import type { GlobalApiResponse } from '@/types/api/responses';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useData, useStream } from '@/provider/StreamProvider';
import useFetchApi from '@/hooks/react-query/useFetchApi';
import {
    addDays,
    dateKey,
    fmtDate,
    fmtDuration,
    fmtKm,
    fmtNum,
    STATUS_LABEL,
    statusOf,
    truckHint,
    truckLabel,
} from '@/lib/format';
import { BarChart, ChartCard, Donut, RankBars, SERIES } from '@/components/fleet/Charts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Empty,
    Stat,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { Report, ReportGroup, ReportRow, TripRecord } from '@/types/fleet';
import type { Status } from '@/lib/format';
import type { DwellStats, VisitReport } from '@/types/fleet/visits';
import { Badge } from '@/components/ui/badge';

const ALL_GROUPS: ReportGroup[] = ['route', 'jetty', 'driver', 'truck', 'shift', 'day'];
const STATUSES: Status[] = ['moving', 'idle', 'parked', 'offline'];

type Preset = 'today' | 'yesterday' | '7d' | 'month' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Hari ini' },
    { id: 'yesterday', label: 'Kemarin' },
    { id: '7d', label: '7 hari' },
    { id: 'month', label: 'Bulan ini' },
    { id: 'custom', label: 'Pilih tanggal' },
];

const GROUPS: { id: ReportGroup; label: string; col: string }[] = [
    { id: 'route', label: 'Rute', col: 'Rute / fleet' },
    { id: 'jetty', label: 'Stockpile / jetty', col: 'Stockpile / jetty' },
    { id: 'driver', label: 'Operator', col: 'Operator' },
    { id: 'truck', label: 'Unit', col: 'Unit' },
    { id: 'shift', label: 'Shift', col: 'Shift' },
    { id: 'day', label: 'Hari', col: 'Tanggal' },
];

type SortKey =
    | 'label'
    | 'trips'
    | 'ton'
    | 'tonPerHour'
    | 'avgDurationMs'
    | 'backAvgMs'
    | 'cycle'
    | 'distance'
    | 'stops'
    | 'fuelUsed'
    | 'avgFuel';

// Cycle time rata-rata = rata-rata hauling + rata-rata return (keduanya harus ada).
function cycleOf(
    r: Pick<ReportRow, 'done' | 'backDone' | 'avgDurationMs' | 'backAvgMs'>,
): number | null {
    return r.done && r.backDone ? r.avgDurationMs + r.backAvgMs : null;
}

function presetRange(
    p: Preset,
    custom: { from: string; to: string },
): { from: string; to: string } {
    const today = dateKey();
    if (p === 'yesterday') return { from: addDays(today, -1), to: addDays(today, -1) };
    if (p === '7d') return { from: addDays(today, -6), to: today };
    if (p === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
    if (p === 'custom')
        return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
    return { from: today, to: today };
}

export default function ReportsView() {
    const fetchApi = useFetchApi();
    const { routes, drivers, devices } = useData();
    const { setStats } = useLayout();
    const [preset, setPreset] = useState<Preset>('today');
    const [custom, setCustom] = useState({ from: addDays(dateKey(), -6), to: dateKey() });
    const [group, setGroup] = useState<ReportGroup>('route');
    const [filter, setFilter] = useState({ route: '', driver: '', imei: '' });
    const [reports, setReports] = useState<Partial<Record<ReportGroup, Report>>>({});
    const [trend, setTrend] = useState<Report | null>(null);
    const [visits, setVisits] = useState<VisitReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'trips', desc: true });
    const [picked, setPicked] = useState<ReportRow | null>(null);

    const range = presetRange(preset, custom);
    const fromMs = new Date(`${range.from}T00:00:00`).getTime();
    const toMs = new Date(`${range.to}T23:59:59.999`).getTime();
    const query = useMemo(() => {
        const q = new URLSearchParams({
            from: String(fromMs),
            to: String(Math.min(toMs, Date.now())),
        });
        if (filter.route) q.set('route', filter.route);
        if (filter.driver) q.set('driver', filter.driver);
        if (filter.imei) q.set('imei', filter.imei);
        return q.toString();
    }, [fromMs, toMs, filter]);
    // Tren harian minimal 7 hari (agar pola "Hari ini" tetap terlihat).
    const trendStart = range.from < addDays(range.to, -6) ? range.from : addDays(range.to, -6);
    const trendFromMs = new Date(`${trendStart}T00:00:00`).getTime();

    // Semua pengelompokan diambil sekaligus: dashboard butuh semuanya, tab tabel tinggal pilih.
    const load = useCallback(
        async (quiet = false) => {
            if (!quiet) setLoading(true);
            const q = Object.fromEntries(new URLSearchParams(query));
            try {
                const [list, tr, vis] = await Promise.all([
                    Promise.all(
                        ALL_GROUPS.map((g) =>
                            fetchApi<Report>('reports', undefined, { ...q, group: g }).catch(
                                () => undefined,
                            ),
                        ),
                    ),
                    fetchApi<Report>('reports', undefined, {
                        ...q,
                        group: 'day',
                        from: String(trendFromMs),
                    }).catch(() => undefined),
                    fetchApi<VisitReport>('reports-visits', undefined, q).catch(() => undefined),
                ]);
                setVisits(vis ?? null);
                const next: Partial<Record<ReportGroup, Report>> = {};
                ALL_GROUPS.forEach((g, i) => {
                    const r = list[i];
                    if (r) next[g] = r;
                });
                setReports(next);
                setTrend(tr ?? null);
            } finally {
                setLoading(false);
            }
        },
        [query, trendFromMs, fetchApi],
    );
    useEffect(() => {
        setPicked(null);
        void load();
    }, [load]);
    const report = reports[group] ?? null;
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useStream((m) => {
        if (m.type !== 'trips') return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void load(true), 1500);
    });

    useEffect(() => {
        const t = report?.total;
        setStats(
            t ? (
                <>
                    <HeaderStat label="Ritase" value={t.done} />
                    <HeaderStat label="Tonase" value={`${fmtNum(t.ton)} t`} />
                    <HeaderStat
                        label="Hauling"
                        value={t.done ? fmtDuration(t.avgDurationMs) : '—'}
                    />
                    <HeaderStat
                        label="Return"
                        value={t.backDone ? fmtDuration(t.backAvgMs) : '—'}
                    />
                    {t.fuelUsed != null && t.fuelUnit && (
                        <HeaderStat label="BBM" value={`${fmtNum(t.fuelUsed, 1)} ${t.fuelUnit}`} />
                    )}
                </>
            ) : null,
        );
    }, [setStats, report]);
    useEffect(() => () => setStats(null), [setStats]);

    const rows = useMemo(() => {
        const list = [...(report?.rows ?? [])];
        const k = sort.key;
        const val = (r: ReportRow) => (k === 'cycle' ? cycleOf(r) : r[k]) ?? -Infinity;
        list.sort((a, b) => {
            const x = val(a);
            const y = val(b);
            const c =
                typeof x === 'string' && typeof y === 'string'
                    ? x.localeCompare(y)
                    : Number(x) - Number(y);
            return sort.desc ? -c : c;
        });
        return list;
    }, [report, sort]);

    const th = (key: SortKey, label: string, right = true) => {
        const on = sort.key === key;
        const Icon = on ? (sort.desc ? ArrowDown : ArrowUp) : ArrowUpDown;
        return (
            <TableHead
                className={cn(right ? 'text-right' : 'sticky left-0 z-[1] bg-card')}
                aria-sort={on ? (sort.desc ? 'descending' : 'ascending') : 'none'}
            >
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center gap-1 uppercase hover:text-foreground',
                        on && 'text-foreground',
                    )}
                    onClick={() => setSort({ key, desc: on ? !sort.desc : key !== 'label' })}
                >
                    {label} <Icon className="size-3" />
                </button>
            </TableHead>
        );
    };

    const t = report?.total;
    const unit = t?.fuelUnit ?? null;
    const fuel = (v: number | null) => (v == null || !unit ? '—' : `${fmtNum(v, 1)} ${unit}`);
    const gcol = GROUPS.find((g) => g.id === group)!.col;
    const rangeText =
        range.from === range.to
            ? fmtDate(range.from)
            : `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
    const trucks = Object.values(devices).sort((a, b) =>
        truckLabel(a).localeCompare(truckLabel(b)),
    );

    const filtered = Boolean(filter.route || filter.driver || filter.imei);

    // Tren: tiap hari di rentang, hari tanpa ritase = 0.
    const days: string[] = [];
    for (let d = trendStart; d <= range.to && d <= dateKey(); d = addDays(d, 1)) days.push(d);
    const byDay = new Map((trend?.rows ?? []).map((r) => [r.key, r]));
    const dayLabel = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;
    const tripBars = days.map((d) => {
        const r = byDay.get(d);
        return {
            key: d,
            label: dayLabel(d),
            value: r?.done ?? 0,
            tip: `${fmtDate(d)} · ${r?.done ?? 0} ritase`,
        };
    });
    const cycleBars = days.map((d) => {
        const r = byDay.get(d);
        const c = r ? cycleOf(r) : null;
        return {
            key: d,
            label: dayLabel(d),
            value: c != null ? c / 60e3 : 0,
            tip: `${fmtDate(d)} · ${c != null ? fmtDuration(c) : 'belum ada putaran'}`,
        };
    });
    const fuelBars = days.map((d) => {
        const r = byDay.get(d);
        return {
            key: d,
            label: dayLabel(d),
            value: r?.fuelUsed ?? 0,
            tip: `${fmtDate(d)} · ${fuel(r?.fuelUsed ?? null)}`,
        };
    });
    const rank = (g: ReportGroup, pick: (r: ReportRow) => number) =>
        (reports[g]?.rows ?? []).map((r) => ({
            key: r.key,
            label: r.label,
            sub: r.sub,
            value: pick(r),
        }));

    // Kondisi armada sekarang (live dari stream).
    const fleet = Object.values(devices);
    const statusCount = STATUSES.map((st) => ({
        key: st,
        label: STATUS_LABEL[st],
        value: fleet.filter((d) => statusOf(d) === st).length,
    }));
    const online = fleet.length - (statusCount.find((x) => x.key === 'offline')?.value ?? 0);
    const activeDrivers = drivers.filter((d) => d.active).length;

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 md:p-6">
            <Card className="gap-3 px-4" aria-label="Filter laporan">
                <div className="flex flex-wrap items-center gap-2">
                    <ToggleGroup
                        type="single"
                        value={preset}
                        onValueChange={(v) => v && setPreset(v as Preset)}
                        className="flex-wrap"
                        aria-label="Periode"
                    >
                        {PRESETS.map((p) => (
                            <ToggleGroupItem key={p.id} value={p.id}>
                                {p.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    {preset === 'custom' && (
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                className="w-40"
                                value={custom.from}
                                max={dateKey()}
                                onChange={(e) =>
                                    e.target.value && setCustom({ ...custom, from: e.target.value })
                                }
                                aria-label="Dari tanggal"
                            />
                            <span className="text-muted-foreground">–</span>
                            <Input
                                type="date"
                                className="w-40"
                                value={custom.to}
                                max={dateKey()}
                                onChange={(e) =>
                                    e.target.value && setCustom({ ...custom, to: e.target.value })
                                }
                                aria-label="Sampai tanggal"
                            />
                        </div>
                    )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <Combobox
                        value={filter.route}
                        onChange={(v) => setFilter({ ...filter, route: v })}
                        options={[
                            { value: '', label: 'Semua rute' },
                            ...routes.map((r) => ({ value: r.id, label: r.name })),
                        ]}
                        placeholder="Semua rute"
                        searchPlaceholder="Cari rute…"
                        icon={<RouteIcon className="size-4 text-muted-foreground" />}
                        aria-label="Filter rute"
                    />
                    <Combobox
                        value={filter.driver}
                        onChange={(v) => setFilter({ ...filter, driver: v })}
                        options={[
                            { value: '', label: 'Semua operator' },
                            ...drivers.map((d) => ({
                                value: d.id,
                                label: d.name,
                                hint: d.employeeNo ?? undefined,
                            })),
                        ]}
                        placeholder="Semua operator"
                        searchPlaceholder="Cari operator…"
                        icon={<UserRound className="size-4 text-muted-foreground" />}
                        aria-label="Filter operator"
                    />
                    <Combobox
                        value={filter.imei}
                        onChange={(v) => setFilter({ ...filter, imei: v })}
                        options={[
                            { value: '', label: 'Semua unit' },
                            ...trucks.map((d) => ({
                                value: d.imei,
                                label: truckLabel(d),
                                hint: truckHint(d),
                            })),
                        ]}
                        placeholder="Semua unit"
                        searchPlaceholder="Cari plat…"
                        icon={<Truck className="size-4 text-muted-foreground" />}
                        aria-label="Filter unit"
                    />
                    {filtered && (
                        <Button
                            variant="ghost"
                            onClick={() => setFilter({ route: '', driver: '', imei: '' })}
                        >
                            <RotateCcw /> Reset
                        </Button>
                    )}
                </div>
            </Card>

            <div className="flex flex-col gap-3">
                <span className="text-sm font-semibold text-muted-foreground">{rangeText}</span>
                {t && (
                    <section
                        className="grid grid-cols-2 gap-3 md:grid-cols-4"
                        aria-label="Ringkasan"
                    >
                        <Stat
                            label="Ritase selesai"
                            value={t.done}
                            sub={`${t.backDone} return${t.trips > t.done ? ` · ${t.trips - t.done} belum sampai` : ''}`}
                            big
                        />
                        <Stat
                            label="Tonase"
                            value={`${fmtNum(t.ton)} t`}
                            sub={
                                t.tonPerHour
                                    ? `produktivitas ${fmtNum(t.tonPerHour, 1)} t/jam`
                                    : 'ritase × truck factor'
                            }
                            big
                        />
                        <Stat
                            label="Hauling (pit → stockpile / jetty)"
                            value={t.done ? fmtDuration(t.avgDurationMs) : '—'}
                            sub={
                                t.done
                                    ? `${fmtDuration(t.minDurationMs)} – ${fmtDuration(t.maxDurationMs)}`
                                    : undefined
                            }
                            big
                        />
                        <Stat
                            label="Return (stockpile / jetty → pit)"
                            value={t.backDone ? fmtDuration(t.backAvgMs) : '—'}
                            sub={
                                t.backDone
                                    ? `${fmtDuration(t.backMinMs)} – ${fmtDuration(t.backMaxMs)}`
                                    : undefined
                            }
                            big
                        />
                        <Stat
                            label="Cycle time (1 putaran)"
                            value={cycleOf(t) != null ? fmtDuration(cycleOf(t)!) : '—'}
                            sub="hauling + return, rata-rata"
                        />
                        <Stat label="Total jarak" value={`${fmtKm(t.distance)} km`} />
                        <Stat
                            label="Berhenti di jalan"
                            value={`${t.stops}×`}
                            sub={t.stops ? fmtDuration(t.stoppedMs) : undefined}
                        />
                        <Stat
                            label="BBM terpakai"
                            value={fuel(t.fuelUsed)}
                            sub={t.avgFuel != null ? `${fuel(t.avgFuel)} / ritase` : undefined}
                        />
                        <Stat
                            label="BBM pit → stockpile / jetty"
                            value={
                                t.avgFuelAtLoading != null
                                    ? `${fmtNum(t.avgFuelAtLoading, 1)} → ${fmtNum(t.avgFuelAtUnloading ?? 0, 1)}`
                                    : '—'
                            }
                            sub={unit ? `rata-rata, ${unit}` : undefined}
                        />
                    </section>
                )}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard title="Waktu di pit" hint="antri + muat">
                    <DwellBox s={visits?.loading} />
                </ChartCard>
                <ChartCard title="Waktu di stockpile / jetty" hint="antri + bongkar">
                    <DwellBox s={visits?.unloading} />
                </ChartCard>
                <ChartCard
                    title="Sedang di titik saat ini"
                    hint={visits ? `${visits.current.length} unit` : undefined}
                >
                    {!visits?.current.length ? (
                        <p className="m-0 py-6 text-center text-sm text-muted-foreground">
                            Tidak ada unit di pit / stockpile / jetty.
                        </p>
                    ) : (
                        <ul className="m-0 flex max-h-56 list-none flex-col gap-2 overflow-y-auto p-0">
                            {visits.current.map((c) => (
                                <li
                                    key={`${c.imei}-${c.arriveAt}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[13px]"
                                >
                                    <span className="flex min-w-0 flex-col">
                                        <b className="truncate">
                                            {c.truck}
                                            {c.driverName ? ` · ${c.driverName}` : ''}
                                        </b>
                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Badge
                                                variant={
                                                    c.role === 'loading' ? 'success' : 'warning'
                                                }
                                            >
                                                {c.role === 'loading' ? 'Pit' : 'Stockpile / jetty'}
                                            </Badge>
                                            <span className="truncate">{c.siteName}</span>
                                        </span>
                                    </span>
                                    <b className="shrink-0 tabular-nums">
                                        {fmtDuration(c.dwellMs)}
                                    </b>
                                </li>
                            ))}
                        </ul>
                    )}
                </ChartCard>
            </div>

            {Boolean(visits?.sites.length) && (
                <ChartCard title="Rata-rata waktu per titik" hint="menit">
                    <RankBars
                        rows={(visits?.sites ?? []).map((x) => ({
                            key: x.siteId,
                            label: x.siteName,
                            sub: `${x.role === 'loading' ? 'pit' : 'stockpile / jetty'} · ${x.visits}× selesai${x.inside ? ` · ${x.inside} di dalam` : ''}`,
                            value: x.avgDwellMs / 60e3,
                        }))}
                        color={SERIES[4]}
                        format={(v) => fmtNum(v, 1)}
                        limit={10}
                    />
                </ChartCard>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <ChartCard
                    title="Tren ritase harian"
                    hint={`${fmtDate(trendStart)} – ${fmtDate(days[days.length - 1] ?? range.to)}`}
                    className="lg:col-span-2"
                >
                    <BarChart bars={tripBars} empty="Belum ada ritase di rentang ini." />
                </ChartCard>
                <ChartCard title="Armada sekarang" hint={`${activeDrivers} operator aktif`}>
                    <Donut
                        slices={statusCount}
                        center={
                            <span className="flex flex-col leading-tight">
                                <b className="text-2xl tabular-nums">{online}</b>
                                <span className="text-[11px] text-muted-foreground">
                                    dari {fleet.length} online
                                </span>
                            </span>
                        }
                        empty="Belum ada unit terdaftar."
                    />
                </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Rata-rata 1 putaran per hari" hint="menit">
                    <BarChart
                        bars={cycleBars}
                        color={SERIES[1]}
                        height={170}
                        empty="Belum ada putaran lengkap."
                    />
                </ChartCard>
                <ChartCard title="BBM terpakai per hari" hint={unit ?? undefined}>
                    <BarChart
                        bars={fuelBars}
                        color={SERIES[3]}
                        height={170}
                        empty="Belum ada data BBM."
                    />
                </ChartCard>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ChartCard title="Rute teramai" hint="ritase">
                    <RankBars rows={rank('route', (r) => r.done)} />
                </ChartCard>
                <ChartCard title="Ritase per stockpile / jetty" hint="ritase">
                    <RankBars rows={rank('jetty', (r) => r.done)} color={SERIES[3]} />
                </ChartCard>
                <ChartCard title="Operator teratas" hint="ritase">
                    <RankBars rows={rank('driver', (r) => r.done)} color={SERIES[1]} />
                </ChartCard>
                <ChartCard title="Unit teratas" hint="ritase">
                    <RankBars rows={rank('truck', (r) => r.done)} color={SERIES[2]} />
                </ChartCard>
                <ChartCard title="Ritase per shift">
                    <Donut
                        slices={(reports.shift?.rows ?? []).map((r) => ({
                            key: r.key,
                            label: r.label,
                            value: r.done,
                        }))}
                        center={
                            <span className="flex flex-col leading-tight">
                                <b className="text-2xl tabular-nums">{t?.done ?? 0}</b>
                                <span className="text-[11px] text-muted-foreground">ritase</span>
                            </span>
                        }
                    />
                </ChartCard>
                <ChartCard title="Jarak tempuh per unit" hint="km">
                    <RankBars
                        rows={rank('truck', (r) => r.distance / 1000)}
                        color={SERIES[3]}
                        format={(v) => fmtNum(v, v < 10 ? 1 : 0)}
                    />
                </ChartCard>
                <ChartCard title="BBM per unit" hint={unit ?? undefined}>
                    <RankBars
                        rows={rank('truck', (r) => r.fuelUsed ?? 0)}
                        color={SERIES[4]}
                        format={(v) => fmtNum(v, 1)}
                        empty="Belum ada data BBM."
                    />
                </ChartCard>
            </div>

            <h2 className="m-0 mt-2 text-base font-semibold">Detail laporan</h2>
            <Card className="gap-3 pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4">
                    <Tabs
                        value={group}
                        onValueChange={(v) => {
                            setGroup(v as ReportGroup);
                            setPicked(null);
                        }}
                    >
                        <TabsList className="h-auto flex-wrap">
                            {GROUPS.map((g) => (
                                <TabsTrigger key={g.id} value={g.id} className="h-8">
                                    Per {g.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    {loading && <span className="text-xs text-muted-foreground">Memuat…</span>}
                </div>

                {!loading && rows.length === 0 ? (
                    <Empty className="px-4 pb-4">
                        Belum ada ritase di periode ini. Ritase tercatat dari penugasan shift: tiap
                        kali unit keluar dari pit lalu sampai di stockpile / jetty rutenya.
                    </Empty>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {th('label', gcol, false)}
                                {th('trips', 'Ritase')}
                                {th('ton', 'Tonase')}
                                {th('tonPerHour', 'Ton / jam')}
                                {th('avgDurationMs', 'Hauling')}
                                {th('backAvgMs', 'Return')}
                                {th('cycle', 'Cycle time')}
                                {th('distance', 'Jarak')}
                                {th('stops', 'Berhenti')}
                                {th('fuelUsed', 'BBM total')}
                                {th('avgFuel', 'BBM / ritase')}
                                <TableHead className="text-right">
                                    BBM pit → stockpile / jetty
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow
                                    key={r.key}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setPicked(r)}
                                >
                                    <TableCell className="sticky left-0 z-[1] bg-card">
                                        <button
                                            type="button"
                                            className="flex flex-col text-left"
                                            aria-haspopup="dialog"
                                        >
                                            <b>{group === 'day' ? fmtDate(r.label) : r.label}</b>
                                            {r.sub && group !== 'day' && (
                                                <small className="text-xs text-muted-foreground">
                                                    {r.sub}
                                                </small>
                                            )}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        <b>{r.done}</b>
                                        {r.trips > r.done ? (
                                            <span className="text-muted-foreground">
                                                {' '}
                                                +{r.trips - r.done}
                                            </span>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {fmtNum(r.ton)} t
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.tonPerHour ? fmtNum(r.tonPerHour, 1) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.done ? fmtDuration(r.avgDurationMs) : '—'}
                                        {r.done > 1 && (
                                            <small className="block text-xs text-muted-foreground">
                                                {fmtDuration(r.minDurationMs)} –{' '}
                                                {fmtDuration(r.maxDurationMs)}
                                            </small>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.backDone ? fmtDuration(r.backAvgMs) : '—'}
                                        {r.backDone > 1 && (
                                            <small className="block text-xs text-muted-foreground">
                                                {fmtDuration(r.backMinMs)} –{' '}
                                                {fmtDuration(r.backMaxMs)} · {r.backDone}×
                                            </small>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {cycleOf(r) != null ? fmtDuration(cycleOf(r)!) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {fmtKm(r.distance)} km
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.stops}×
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {fuel(r.fuelUsed)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {fuel(r.avgFuel)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {r.avgFuelAtLoading != null
                                            ? `${fmtNum(r.avgFuelAtLoading, 1)} → ${fmtNum(r.avgFuelAtUnloading ?? 0, 1)}`
                                            : '—'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <Detail row={picked} group={group} query={query} onClose={() => setPicked(null)} />
        </div>
    );
}

// Detail ritase satu baris laporan.
function Detail({
    row,
    group,
    query,
    onClose,
}: {
    row: ReportRow | null;
    group: ReportGroup;
    query: string;
    onClose: () => void;
}) {
    const [trips, setTrips] = useState<TripRecord[] | null>(null);
    const [total, setTotal] = useState(0);
    const fetchApi = useFetchApi();
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!row) return;
        let alive = true;
        const q = new URLSearchParams(query);
        if (group === 'route' && /^[0-9a-f-]{36}$/.test(row.key)) q.set('route', row.key);
        if (group === 'driver' && row.key !== '-') q.set('driver', row.key);
        if (group === 'truck') q.set('imei', row.key);
        if (group === 'shift' && row.key !== '-') q.set('shift', row.key);
        if (group === 'day') {
            q.set('from', String(new Date(`${row.key}T00:00:00`).getTime()));
            q.set('to', String(new Date(`${row.key}T23:59:59.999`).getTime()));
        }
        setTrips(null);
        q.set('limit', '500');
        fetchApi<TripRecord[]>('reports-trips', undefined, Object.fromEntries(q))
            .then((rows) => {
                if (!alive) return;
                // fms-backend: data = trips, meta.total_data = total.
                const meta = queryClient.getQueryData<GlobalApiResponse<TripRecord[]>>([
                    'reports-trips',
                    undefined,
                    Object.fromEntries(q),
                ])?.meta;
                const r = { trips: rows ?? [], total: meta?.total_data ?? rows?.length ?? 0 };
                // Baris "tanpa operator/shift" tidak dapat difilter di server, sehingga disaring di sini.
                const list =
                    group === 'driver' && row.key === '-'
                        ? r.trips.filter((x) => !x.driverId)
                        : group === 'shift' && row.key === '-'
                          ? r.trips.filter((x) => !x.shiftId)
                          : r.trips;
                setTrips(list);
                setTotal(r.total);
            })
            .catch(() => alive && setTrips([]));
        return () => {
            alive = false;
        };
    }, [row, group, query, fetchApi, queryClient]);

    const show = (['date', 'shift', 'driver', 'truck', 'route'] as const).filter(
        (c) =>
            !(group === 'driver' && c === 'driver') &&
            !(group === 'truck' && c === 'truck') &&
            !(group === 'route' && c === 'route') &&
            !(group === 'shift' && c === 'shift'),
    );
    return (
        <Dialog open={row != null} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle>
                        Ritase · {row ? (group === 'day' ? fmtDate(row.label) : row.label) : ''}
                    </DialogTitle>
                    <DialogDescription>
                        {row?.sub && group !== 'day'
                            ? row.sub
                            : 'Detail tiap ritase di periode ini.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border">
                    {trips == null ? (
                        <Empty className="p-4">Memuat…</Empty>
                    ) : (
                        <TripTable trips={trips} show={[...show]} />
                    )}
                </div>
                {trips && total > trips.length && (
                    <Empty className="text-xs">
                        Nampilin {trips.length} dari {total} ritase terbaru.
                    </Empty>
                )}
            </DialogContent>
        </Dialog>
    );
}

// Ringkasan waktu di satu jenis titik (loading / unloading).
function DwellBox({ s }: { s: DwellStats | undefined }) {
    if (!s || (!s.visits && !s.inside))
        return (
            <p className="m-0 py-6 text-center text-sm text-muted-foreground">
                Belum ada unit mampir di periode ini.
            </p>
        );
    return (
        <div className="grid grid-cols-2 gap-3">
            <Stat
                label="Rata-rata"
                value={s.visits ? fmtDuration(s.avgDwellMs) : '—'}
                sub={`${s.visits}× selesai`}
                big
            />
            <Stat
                label="Terlama"
                value={fmtDuration(s.maxDwellMs)}
                sub={s.visits ? `tercepat ${fmtDuration(s.minDwellMs)}` : undefined}
                big
            />
            <Stat label="Total waktu" value={fmtDuration(s.totalMs)} />
            <Stat label="Di dalam sekarang" value={`${s.inside} unit`} />
        </div>
    );
}
