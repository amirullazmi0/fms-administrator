'use client';
// Sidebar button: start / stop the backend's fake trucks (feature "simulation").
// Hidden while the feature is off (menu Fitur) or the user lacks simulation.run.
import { useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useToast } from '@/components/fleet/Toasts';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Tip } from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { SimulationStatus } from '@/types/feature';

export default function SimulationButton({
    mini,
    className,
}: {
    mini: boolean;
    className: string;
}) {
    const can = useCan();
    const toast = useToast();
    const allowed = can(P.simulationRun);
    const sim = useQueryApiRequest<GlobalApiResponse<SimulationStatus>>({
        key: 'simulation',
        config: { errorNotification: false },
        options: { enabled: allowed, refetchInterval: 30000 },
    });
    const start = useMutationApiRequest<GlobalApiResponse<SimulationStatus>, object>({
        key: 'simulation-start',
        config: SILENT,
    });
    const stop = useMutationApiRequest<GlobalApiResponse<SimulationStatus>, object>({
        key: 'simulation-stop',
        config: SILENT,
    });
    const [busy, setBusy] = useState(false);
    const s = sim.data?.data;
    if (!allowed || !s?.enabled) return null;

    const toggle = async () => {
        setBusy(true);
        try {
            if (s.running) {
                await stop.mutateAsync({});
                toast({
                    title: 'Simulasi dihentikan',
                    body: 'Unit simulasi putus dari server.',
                    level: 'warn',
                });
            } else {
                const r = await start.mutateAsync({});
                toast({
                    title: 'Simulasi jalan',
                    body: `${r.data?.devices ?? s.devices} unit palsu konek, data tiap ${r.data?.interval ?? s.interval} detik.`,
                });
            }
        } catch (err) {
            toast({
                title: s.running ? 'Gagal menghentikan simulasi' : 'Gagal menjalankan simulasi',
                body: errText(err),
                level: 'crit',
            });
        } finally {
            setBusy(false);
        }
    };

    const label = s.running ? `Hentikan simulasi (${s.devices} unit)` : 'Jalankan simulasi';
    const Icon = s.running ? Square : Play;
    const btn = (
        <button
            type="button"
            className={cn(
                className,
                s.running && 'bg-sidebar-accent text-sidebar-strong',
                mini && 'justify-center px-0',
            )}
            onClick={() => void toggle()}
            disabled={busy}
            aria-label={label}
            aria-pressed={s.running}
        >
            <span className="relative grid place-items-center">
                <Icon className={cn('size-4', s.running && 'fill-current text-destructive')} />
                {s.running && (
                    <i className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full bg-success" />
                )}
            </span>
            {!mini && <span className="truncate">{busy ? 'Sebentar…' : label}</span>}
        </button>
    );
    return mini ? <Tip label={label}>{btn}</Tip> : btn;
}
