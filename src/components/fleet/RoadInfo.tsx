'use client';
// Jalur jalan loading → unloading dan estimasi waktu tempuh truk.
// Kalau server routing nggak kejangkau, tampilin perkiraan kasar dari jarak lurus.
import type { ReactNode } from 'react';
import { fmtDuration, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Empty } from '@/components/ui/misc';
import { distanceM } from '@/lib/geo';
import type { LatLng, RoadRoute, RouteHistory } from '@/types/fleet';

export interface RoadState {
  loading: boolean;
  data: RoadRoute | null;
  error: string | null;
}

// Perkiraan kasar: jalan biasanya ±1,4× jarak lurus, truk rata-rata 40 km/jam.
const DETOUR = 1.4;
const TRUCK_KMH = 40;

const km = (m: number) => `${fmtNum(m / 1000, m < 10000 ? 1 : 0)} km`;

interface Props {
  from: LatLng;
  to: LatLng;
  road: RoadState;
  active: number;
  onActive: (i: number) => void;
  history: RouteHistory | null; // null = rute belum disimpan / belum dimuat
}

export default function RoadInfo(props: Props) {
  return (
    <>
      <HistoryInfo history={props.history} />
      <PlannedInfo {...props} />
    </>
  );
}

// Kotak info jalur. key = warna garis di peta.
function Box({ line, title, children }: { line: 'actual' | 'planned' | 'rough'; title: ReactNode; children: ReactNode }) {
  const key = { actual: 'bg-success', planned: 'bg-info', rough: 'bg-[repeating-linear-gradient(90deg,var(--info)_0_5px,transparent_5px_8px)]' }[line];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-dashed bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span className={cn('inline-block h-1 w-5 rounded-full', key)} aria-hidden="true" /> {title}
      </div>
      {children}
    </div>
  );
}

function Nums({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-x-3 gap-y-1.5">
      {items.map(([k, v]) => (
        <span key={k} className="flex flex-col">
          <small className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{k}</small>
          <span className="text-[13.5px] font-medium tabular-nums">{v}</span>
        </span>
      ))}
    </div>
  );
}

// Dari ritase asli: jalur terakhir yang dilalui + rata-rata waktu tempuh.
function HistoryInfo({ history: h }: { history: RouteHistory | null }) {
  if (!h) return null;
  if (!h.trips) {
    return (
      <Box line="actual" title="Jalur asli truk">
        <Empty>Belum ada ritase selesai di rute ini dalam {h.days} hari terakhir. Garis jalan asli muncul setelah truk pertama kali jalan dari loading ke unloading.</Empty>
      </Box>
    );
  }
  const unit = h.fuelUnit;
  return (
    <Box line="actual" title={`Jalur asli truk · ${h.trips} ritase (${h.days} hari)`}>
      <Nums
        items={[
          ['Rata-rata', fmtDuration(h.avgDurationMs)],
          ['Tercepat', fmtDuration(h.minDurationMs)],
          ['Terlama', fmtDuration(h.maxDurationMs)],
          ['Jarak', km(h.avgDistance)],
          ['Berhenti', `${fmtNum(h.avgStops, 1)}×`],
          ['BBM', h.avgFuel != null && unit ? `${fmtNum(h.avgFuel, 1)} ${unit}` : '—'],
        ]}
      />
      {h.latest && (
        <Empty className="text-xs">Garis hijau = ritase terakhir ({new Date(h.latest.end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}, {fmtDuration(h.latest.durationMs)}, {km(h.latest.distance)}).</Empty>
      )}
    </Box>
  );
}

// Dari routing (OSRM / data jalan OSM), atau perkiraan kasar kalau dua-duanya gagal.
function PlannedInfo({ from, to, road, active, onActive, history }: Props) {
  const straight = distanceM(from, to);

  if (road.loading) return <Empty>Nyari jalur jalan…</Empty>;

  if (!road.data) {
    if (history?.trips) return null; // udah ada estimasi dari perjalanan asli, perkiraan kasar nggak perlu
    const est = straight * DETOUR;
    return (
      <Box line="rough" title="Estimasi kasar">
        <Nums items={[['Jarak ±', km(est)], ['Waktu truk ±', fmtDuration((est / 1000 / TRUCK_KMH) * 3600e3)]]} />
        <Empty className="text-xs">
          Jalur jalan nggak bisa diambil{road.error ? ` (${road.error})` : ''}. Ini perkiraan dari jarak lurus {km(straight)} × {DETOUR} dengan kecepatan truk {TRUCK_KMH} km/jam.
        </Empty>
      </Box>
    );
  }

  const { paths, truckFactor } = road.data;
  return (
    <Box line="planned" title="Jalur yang bisa dilalui">
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {paths.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              aria-pressed={i === active}
              onClick={() => onActive(i)}
              className={cn('flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-ring', i === active && 'border-info ring-3 ring-info/20')}
            >
              <span className={cn('text-xs font-semibold', i === active && 'text-info')}>{i === 0 ? 'Jalur utama' : `Alternatif ${i}`}</span>
              <Nums items={[['Jarak', km(p.distance)], ['Truk ±', fmtDuration(p.truckDurationS * 1000)], ['Mobil', fmtDuration(p.durationS * 1000)]]} />
            </button>
          </li>
        ))}
      </ol>
      <Empty className="text-xs">Dari {road.data.source}. Estimasi truk = waktu mobil × {fmtNum(truckFactor, 1)}, belum termasuk macet &amp; istirahat.</Empty>
    </Box>
  );
}
