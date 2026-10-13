'use client';
// Data jalan: road paths the server computed (from → to, coords JSON) and the OSM road data
// per area. Deleting = computed / downloaded again the next time it is needed.
import { useEffect, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import Pager from '@/components/custom/pager';
import PathPreview from '@/components/custom/path-preview';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { ago, fmtDuration, fmtKm, fmtNum } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Empty,
    KV,
    Note,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { RoadAreaRow, RoadPathRow } from '@/types/road';

type Tab = 'paths' | 'areas';
type Pending = { kind: 'path' | 'area'; id: string | null; label: string };

const dt = (ms: number) =>
    new Date(ms).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
const coord = (lat: number, lng: number) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
const size = (b: number) =>
    b >= 1 << 20 ? `${fmtNum(b / (1 << 20), 1)} MB` : `${fmtNum(b / 1024, 0)} KB`;

export default function RoadsView() {
    const { setStats } = useLayout();
    const can = useCan();
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('paths');
    const [page, setPage] = useState(1);
    const [viewId, setViewId] = useState<string | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);

    const paths = useQueryApiRequest<GlobalApiResponse<RoadPathRow[]>>({
        key: 'road-paths',
        queries: { page, limit: 20 },
    });
    const areas = useQueryApiRequest<GlobalApiResponse<RoadAreaRow[]>>({
        key: 'road-areas',
        options: { enabled: tab === 'areas' },
    });
    const detail = useQueryApiRequest<GlobalApiResponse<RoadPathRow>>({
        key: 'road-paths-by-id',
        params: { id: viewId ?? '' },
        options: { enabled: viewId != null },
    });
    const delPath = useMutationApiRequest<
        GlobalApiResponse<{ deleted: number }>,
        { __params: { id: string } }
    >({ key: 'road-paths-delete', config: SILENT });
    const delPaths = useMutationApiRequest<GlobalApiResponse<{ deleted: number }>, object>({
        key: 'road-paths-delete-all',
        config: SILENT,
    });
    const delArea = useMutationApiRequest<
        GlobalApiResponse<{ deleted: number }>,
        { __params: { id: string } }
    >({ key: 'road-areas-delete', config: SILENT });
    const delAreas = useMutationApiRequest<GlobalApiResponse<{ deleted: number }>, object>({
        key: 'road-areas-delete-all',
        config: SILENT,
    });

    const pathList = paths.data?.data ?? [];
    const areaList = areas.data?.data ?? [];
    const totalPaths = paths.data?.meta?.total_data ?? pathList.length;
    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Jalur" value={totalPaths} />
                {tab === 'areas' && <HeaderStat label="Area" value={areaList.length} />}
            </>,
        );
    }, [setStats, totalPaths, tab, areaList.length]);
    useEffect(() => () => setStats(null), [setStats]);

    const remove = async (p: Pending) => {
        try {
            const r =
                p.kind === 'path'
                    ? p.id
                        ? await delPath.mutateAsync({ __params: { id: p.id } })
                        : await delPaths.mutateAsync({})
                    : p.id
                      ? await delArea.mutateAsync({ __params: { id: p.id } })
                      : await delAreas.mutateAsync({});
            toast({
                title: 'Data jalan dihapus',
                body: `${r.data?.deleted ?? 0} ${p.kind === 'path' ? 'jalur' : 'area'} dihapus. Dihitung ulang waktu dibutuhin.`,
                level: 'warn',
            });
            if (p.id && p.id === viewId) setViewId(null);
        } catch (err) {
            toast({ title: 'Gagal ngehapus', body: errText(err), level: 'crit' });
        }
    };
    const canDelete = can(P.roadDelete);
    const place = (name: string | null, lat: number, lng: number) =>
        name ? <b>{name}</b> : <span className="font-mono text-xs">{coord(lat, lng)}</span>;
    const d = detail.data?.data;

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
            <Note tone="info">
                Jalur jalan yang udah dihitung server (titik → titik, lewat jalan OSM) dan data
                jalan per area yang diunduh dari Overpass. Dipakai peta rute & truk simulasi.
                Dihapus = dihitung / diunduh ulang waktu dibutuhin lagi.
            </Note>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                    <TabsList>
                        <TabsTrigger value="paths">Jalur</TabsTrigger>
                        <TabsTrigger value="areas">Data area</TabsTrigger>
                    </TabsList>
                </Tabs>
                {canDelete && (
                    <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                            setPending({
                                kind: tab === 'paths' ? 'path' : 'area',
                                id: null,
                                label: tab === 'paths' ? 'semua jalur' : 'semua data area',
                            })
                        }
                    >
                        <Trash2 /> Hapus semua
                    </Button>
                )}
            </div>

            {tab === 'paths' ? (
                <Card className="gap-0 py-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Dari</TableHead>
                                <TableHead>Ke</TableHead>
                                <TableHead className="text-right">Jarak</TableHead>
                                <TableHead className="text-right">Waktu ±</TableHead>
                                <TableHead className="text-right">Titik</TableHead>
                                <TableHead>Dibuat</TableHead>
                                <TableHead>Terakhir dipakai</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pathList.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        {place(p.from_site, p.from_lat, p.from_lng)}
                                    </TableCell>
                                    <TableCell>{place(p.to_site, p.to_lat, p.to_lng)}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {fmtKm(p.distance_m)} km
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {fmtDuration(p.duration_s * 1000)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {fmtNum(p.point_count)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {dt(p.created_at)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {ago(p.last_used_at)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="inline-flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => setViewId(p.id)}
                                                aria-label="Lihat jalur"
                                            >
                                                <Eye />
                                            </Button>
                                            {canDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() =>
                                                        setPending({
                                                            kind: 'path',
                                                            id: p.id,
                                                            label: `jalur ${p.from_site ?? 'titik'} → ${p.to_site ?? 'titik'}`,
                                                        })
                                                    }
                                                    aria-label="Hapus jalur"
                                                >
                                                    <Trash2 />
                                                </Button>
                                            )}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {paths.isLoading && <Empty className="p-4">Memuat…</Empty>}
                    {!paths.isLoading && pathList.length === 0 && (
                        <Empty className="p-4">Belum ada jalur yang dihitung.</Empty>
                    )}
                    <div className="border-t p-3">
                        <Pager meta={paths.data?.meta} onPage={setPage} />
                    </div>
                </Card>
            ) : (
                <Card className="gap-0 py-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Area (selatan, barat → utara, timur)</TableHead>
                                <TableHead>Jalan</TableHead>
                                <TableHead className="text-right">Elemen</TableHead>
                                <TableHead className="text-right">Ukuran</TableHead>
                                <TableHead>Diunduh</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {areaList.map((a) => (
                                <TableRow key={a.id}>
                                    <TableCell className="font-mono text-xs">
                                        {coord(a.south, a.west)} → {coord(a.north, a.east)}
                                    </TableCell>
                                    <TableCell>
                                        {a.kind === 'all' ? (
                                            <Badge variant="info">Semua jalan</Badge>
                                        ) : (
                                            <Badge variant="muted">Jalan utama</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {fmtNum(a.element_count)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {size(a.size_bytes)}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {dt(a.fetched_at)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() =>
                                                    setPending({
                                                        kind: 'area',
                                                        id: a.id,
                                                        label: 'data area ini',
                                                    })
                                                }
                                                aria-label="Hapus area"
                                            >
                                                <Trash2 />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {areas.isLoading && <Empty className="p-4">Memuat…</Empty>}
                    {!areas.isLoading && areaList.length === 0 && (
                        <Empty className="p-4">Belum ada data area.</Empty>
                    )}
                </Card>
            )}

            <Dialog open={viewId != null} onOpenChange={(o) => !o && setViewId(null)}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            Jalur{' '}
                            {d
                                ? `${d.from_site ?? coord(d.from_lat, d.from_lng)} → ${d.to_site ?? coord(d.to_lat, d.to_lng)}`
                                : ''}
                        </DialogTitle>
                        <DialogDescription>Hijau = dari, oranye = ke.</DialogDescription>
                    </DialogHeader>
                    {!d?.coords ? (
                        <Empty>Memuat…</Empty>
                    ) : (
                        <>
                            <PathPreview coords={d.coords} />
                            <KV
                                rows={[
                                    ['Jarak', `${fmtKm(d.distance_m)} km`],
                                    ['Waktu ±', fmtDuration(d.duration_s * 1000)],
                                    ['Dibuat', dt(d.created_at)],
                                    ['Titik', fmtNum(d.coords.length)],
                                ]}
                            />
                            <details className="rounded-lg border">
                                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                                    Coords (JSON)
                                </summary>
                                <pre className="m-0 max-h-60 overflow-auto border-t bg-muted p-3 font-mono text-[11px] leading-relaxed">
                                    {JSON.stringify(d.coords)}
                                </pre>
                            </details>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={pending != null}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Hapus ${pending?.label ?? ''}?`}
                description="Datanya dihitung / diunduh ulang dari OpenStreetMap waktu dibutuhin lagi (bisa makan waktu beberapa menit)."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => pending && void remove(pending)}
            />
        </div>
    );
}
