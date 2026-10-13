'use client';
// Peta halaman Titik & rute: semua titik, posisi truk, titik yang lagi diedit, dan rute yang dipilih.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { TRUCK_GLYPH } from '@/lib/markers';
import { addBasemap } from '@/lib/basemap';
import 'leaflet/dist/leaflet.css';
import { STATUS_LABEL, ago, lastHeard, statusOf, truckLabel } from '@/lib/format';
import { useDuty } from '@/lib/duty';
import type { Duty } from '@/lib/duty';
import { distanceM } from '@/lib/geo';
import { drawSites, escHtml, siteCircle, siteIcon } from '@/lib/siteLayer';
import type { Device, Site, SiteType } from '@/types/fleet';

export interface Draft {
    name: string;
    lat: number | null;
    lng: number | null;
    radius: number;
}

interface Props {
    sites: Site[];
    devices: Device[];
    selectedId: string | null;
    draft: Draft | null; // titik yang lagi dibuat/diubah (cuma admin)
    editingId: string | null; // id titik yang lagi diubah (disembunyiin dari layer biasa)
    onSelect: (id: string) => void;
    onPick: (lat: number, lng: number) => void; // klik peta / geser penanda
    canEdit: boolean; // true = lagi naruh/mindahin titik. false = klik peta cuma nampilin info koordinat
    routeLine: { from: Site; to: Site } | null; // rute yang lagi dipilih: garis loading -> unloading
    roles?: Map<string, SiteType>; // peran titik di rute yang lagi dipilih (L/U di penanda)
    roadPaths: [number, number][][] | null; // jalur jalan (dari OSRM). null = garis lurus aja
    activePath: number;
    onPathClick: (i: number) => void;
    actualPath: [number, number][] | null; // jejak GPS ritase terakhir (jalan yang beneran dilalui)
    className?: string;
}

const truckDot = L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div class="truck-dot">${TRUCK_GLYPH}</div>`,
});

function truckPopup(d: Device, job: Duty | undefined): string {
    const st = statusOf(d);
    return `<div class="map-pop">
    <div class="mp-title">${escHtml(truckLabel(d))}</div>
    <dl>
      <dt>Status</dt><dd>${STATUS_LABEL[st]}${d.last ? ` · ${d.last.speed} km/jam` : ''}</dd>
      ${job ? `<dt>Supir</dt><dd>${escHtml(job.driverName)} (${escHtml(job.shiftName)})</dd><dt>Rute</dt><dd>${escHtml(job.routeName)}</dd>` : '<dt>Tugas</dt><dd>Nganggur</dd>'}
      <dt>Update</dt><dd>${ago(lastHeard(d))}</dd>
      <dt>Koordinat</dt><dd class="mono">${d.pos!.lat.toFixed(6)}, ${d.pos!.lng.toFixed(6)}</dd>
    </dl>
  </div>`;
}

export default function SitesMap({
    sites,
    devices,
    selectedId,
    draft,
    editingId,
    onSelect,
    onPick,
    canEdit,
    routeLine,
    roles,
    roadPaths,
    activePath,
    onPathClick,
    actualPath,
    className = 'h-full w-full',
}: Props) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const truckLayer = useRef<L.LayerGroup | null>(null);
    const draftLayer = useRef<L.LayerGroup | null>(null);
    const lineLayer = useRef<L.LayerGroup | null>(null);
    const fitLine = useRef('');
    const fitted = useRef(false);
    const popped = useRef<string | null>(null);
    const trucks = useRef(new Map<string, L.Marker>());
    const duty = useDuty();
    const cb = useRef({ onSelect, onPick, canEdit, sites, devices, onPathClick });
    cb.current = { onSelect, onPick, canEdit, sites, devices, onPathClick };

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true }).setView([-6.2, 106.83], 12);
        addBasemap(m);
        truckLayer.current = L.layerGroup().addTo(m);
        lineLayer.current = L.layerGroup().addTo(m);
        siteLayer.current = L.layerGroup().addTo(m);
        draftLayer.current = L.layerGroup().addTo(m);
        m.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            if (cb.current.canEdit) return cb.current.onPick(lat, lng);
            // Nggak lagi naruh titik: tampilin koordinat + titik terdekat.
            const near = cb.current.sites
                .map((s) => ({ s, d: distanceM({ lat, lng }, s) }))
                .sort((a, b) => a.d - b.d)[0];
            const nearTxt = near
                ? `<dt>Titik terdekat</dt><dd>${escHtml(near.s.name)} · ${near.d < 1000 ? `${Math.round(near.d)} m` : `${(near.d / 1000).toFixed(1)} km`}</dd>`
                : '';
            L.popup()
                .setLatLng(e.latlng)
                .setContent(
                    `<div class="map-pop"><dl><dt>Koordinat</dt><dd class="mono">${lat.toFixed(6)}, ${lng.toFixed(6)}</dd>${nearTxt}</dl></div>`,
                )
                .openOn(m);
        });
        map.current = m;
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(el.current!);
        return () => {
            ro.disconnect();
            m.remove();
            trucks.current.clear();
            fitted.current = false;
        };
    }, []);

    // Titik tersimpan
    useEffect(() => {
        if (!siteLayer.current) return;
        const name = (imei: string) => {
            const d = cb.current.devices.find((x) => x.imei === imei);
            return d ? truckLabel(d) : imei;
        };
        const markers = drawSites(
            siteLayer.current,
            sites.filter((s) => s.id !== editingId),
            { onClick: (id) => cb.current.onSelect(id), selectedId, truckName: name, roles },
        );
        // Layer digambar ulang = popup ikut hilang, jadi dibuka lagi buat titik yang baru dipilih.
        if (selectedId && selectedId !== popped.current) markers.get(selectedId)?.openPopup();
        popped.current = selectedId;
    }, [sites, selectedId, editingId, roles]);

    // Posisi truk sekarang (patokan buat naruh titik). Marker di-update, bukan digambar ulang,
    // biar popup yang lagi kebuka nggak ketutup tiap ada data baru.
    useEffect(() => {
        const g = truckLayer.current;
        if (!g) return;
        const alive = new Set<string>();
        for (const d of devices) {
            if (!d.pos) continue;
            alive.add(d.imei);
            const ll: L.LatLngTuple = [d.pos.lat, d.pos.lng];
            const mk = trucks.current.get(d.imei);
            const html = truckPopup(d, duty.get(d.imei));
            if (mk) mk.setLatLng(ll).setPopupContent(html);
            else
                trucks.current.set(
                    d.imei,
                    L.marker(ll, { icon: truckDot, title: truckLabel(d), zIndexOffset: 300 })
                        .bindPopup(html, { maxWidth: 240 })
                        .addTo(g),
                );
        }
        for (const [imei, mk] of trucks.current) {
            if (alive.has(imei)) continue;
            mk.remove();
            trucks.current.delete(imei);
        }
    }, [devices, duty]);

    // Rute yang dipilih: garis putus-putus loading -> unloading, peta zoom ke dua titiknya.
    const lineKey = routeLine
        ? `${routeLine.from.id}|${routeLine.to.id}|${routeLine.from.lat},${routeLine.from.lng}|${routeLine.to.lat},${routeLine.to.lng}`
        : '';
    useEffect(() => {
        const m = map.current;
        const g = lineLayer.current;
        if (!m || !g) return;
        g.clearLayers();
        if (!routeLine) return;
        const a: L.LatLngTuple = [routeLine.from.lat, routeLine.from.lng];
        const b: L.LatLngTuple = [routeLine.to.lat, routeLine.to.lng];
        if (roadPaths?.length) {
            // Alternatif abu-abu di bawah, jalur yang dipilih ungu di atas. Klik garis = pilih jalur.
            roadPaths.forEach((coords, i) => {
                if (i === activePath) return;
                L.polyline(coords, { color: '#6b7280', weight: 5, opacity: 0.55 })
                    .on('click', () => cb.current.onPathClick(i))
                    .bindTooltip(`Alternatif ${i}`, { sticky: true })
                    .addTo(g);
            });
            const main = roadPaths[activePath] ?? roadPaths[0];
            L.polyline(main, {
                color: '#ffffff',
                weight: 9,
                opacity: 0.9,
                interactive: false,
            }).addTo(g);
            L.polyline(main, {
                color: '#7c3aed',
                weight: 5,
                opacity: 0.95,
                interactive: false,
            }).addTo(g);
        } else if (!actualPath?.length) {
            // Belum ada jalur jalan sama sekali: garis lurus putus-putus sebagai penanda arah.
            L.polyline([a, b], {
                color: '#ffffff',
                weight: 7,
                opacity: 0.85,
                interactive: false,
            }).addTo(g);
            L.polyline([a, b], {
                color: '#7c3aed',
                weight: 4,
                dashArray: '8 8',
                interactive: false,
            }).addTo(g);
        }
        if (actualPath?.length) {
            L.polyline(actualPath, {
                color: '#ffffff',
                weight: 9,
                opacity: 0.9,
                interactive: false,
            }).addTo(g);
            L.polyline(actualPath, { color: '#16a34a', weight: 5, opacity: 0.95 })
                .bindTooltip('Jalur asli ritase terakhir', { sticky: true })
                .addTo(g);
        }
        const fitKey = `${lineKey}|${roadPaths?.length ?? 0}|${actualPath?.length ?? 0}`;
        if (fitLine.current !== fitKey) {
            fitLine.current = fitKey;
            const all: L.LatLngTuple[] = [
                a,
                b,
                ...(roadPaths?.flat() ?? []),
                ...(actualPath ?? []),
            ];
            m.fitBounds(L.latLngBounds(all), { padding: [60, 60], maxZoom: 17 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineKey, roadPaths, activePath, actualPath]);

    // Titik yang lagi diedit: penanda bisa digeser
    useEffect(() => {
        const g = draftLayer.current;
        if (!g) return;
        g.clearLayers();
        if (!draft || draft.lat == null || draft.lng == null) return;
        siteCircle({ lat: draft.lat, lng: draft.lng, radius: draft.radius }, null, true).addTo(g);
        const mk = L.marker([draft.lat, draft.lng], {
            icon: siteIcon(draft.name || 'Titik baru', null, true),
            draggable: true,
            zIndexOffset: 1000,
        });
        mk.bindTooltip(
            `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)} · radius ${draft.radius} m`,
            { direction: 'top', offset: [0, -14] },
        );
        mk.on('dragend', () => {
            const ll = mk.getLatLng();
            cb.current.onPick(ll.lat, ll.lng);
        });
        mk.addTo(g);
        // Mis. habis "pakai posisi truk": kalau titiknya di luar layar, peta ikut geser.
        const m = map.current;
        if (m && !m.getBounds().contains([draft.lat, draft.lng]))
            m.setView([draft.lat, draft.lng], Math.max(m.getZoom(), 17));
    }, [draft]);

    // Zoom awal: ke semua titik, kalau belum ada ke posisi truk.
    useEffect(() => {
        const m = map.current;
        if (!m || fitted.current) return;
        const pts: L.LatLngTuple[] = sites.length
            ? sites.map((s) => [s.lat, s.lng])
            : devices.filter((d) => d.pos).map((d) => [d.pos!.lat, d.pos!.lng]);
        if (!pts.length) return;
        fitted.current = true;
        if (pts.length === 1) m.setView(pts[0], 17);
        else m.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 17 });
    }, [sites, devices]);

    // Titik dipilih dari daftar: geser peta ke sana.
    useEffect(() => {
        const m = map.current;
        const s = sites.find((x) => x.id === selectedId);
        if (m && s) m.setView([s.lat, s.lng], Math.max(m.getZoom(), 18));
        // cuma waktu pilihan berubah
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    return <div ref={el} className={className} aria-label="Peta titik lokasi" />;
}
