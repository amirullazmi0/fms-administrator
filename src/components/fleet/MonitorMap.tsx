'use client';
// Peta monitoring manajemen: setiap unit diwarnai menurut status operasional (Working / Standby
// terencana / Standby tidak terencana / Breakdown / Offline) dari MDT atau supervisor, dengan label
// unit dan front loading / dumping. Klik unit = pilih (detail di panel samping).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBasemap } from '@/lib/basemap';
import { drawSites, escHtml } from '@/lib/siteLayer';
import type { Site } from '@/types/fleet';

export type MonitorTone =
    'working' | 'standby_planned' | 'standby_unplanned' | 'breakdown' | 'none' | 'offline';

export const MONITOR_TONE: Record<MonitorTone, { label: string; color: string }> = {
    working: { label: 'Working', color: '#16a34a' },
    standby_planned: { label: 'Standby terencana', color: '#2f6fe4' },
    standby_unplanned: { label: 'Standby tidak terencana', color: '#d97706' },
    breakdown: { label: 'Breakdown', color: '#dc2626' },
    none: { label: 'Tanpa status', color: '#64748b' },
    offline: { label: 'Offline', color: '#94a3b8' },
};

export interface MonitorUnit {
    imei: string;
    label: string;
    lat: number;
    lng: number;
    angle: number;
    tone: MonitorTone;
    status: string; // nama delay code / status
    driver: string | null;
}

function icon(u: MonitorUnit, selected: boolean): L.DivIcon {
    const c = MONITOR_TONE[u.tone].color;
    const ring = selected ? '0 0 0 4px rgba(17,24,39,.35)' : '0 1px 3px rgba(0,0,0,.35)';
    return L.divIcon({
        className: '',
        iconSize: [0, 0],
        html: `<div style="position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:4px;white-space:nowrap">
            <span style="width:18px;height:18px;border-radius:9999px;background:${c};border:3px solid #fff;box-shadow:${ring};${u.tone === 'offline' ? 'opacity:.6' : ''}"></span>
            <span style="font:600 11px system-ui;background:#fff;color:#111827;padding:1px 5px;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.25)">${escHtml(u.label)}</span>
        </div>`,
    });
}

export default function MonitorMap({
    units,
    sites,
    selected,
    onSelect,
}: {
    units: MonitorUnit[];
    sites: Site[];
    selected: string | null;
    onSelect: (imei: string) => void;
}) {
    const el = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const unitLayer = useRef<L.LayerGroup | null>(null);
    const siteLayer = useRef<L.LayerGroup | null>(null);
    const cb = useRef(onSelect);
    const fitted = useRef(false);

    useEffect(() => {
        cb.current = onSelect;
    }, [onSelect]);

    useEffect(() => {
        const m = L.map(el.current!, { zoomControl: true }).setView([-6.2, 106.83], 12);
        addBasemap(m);
        siteLayer.current = L.layerGroup().addTo(m);
        unitLayer.current = L.layerGroup().addTo(m);
        map.current = m;
        const ro = new ResizeObserver(() => m.invalidateSize());
        ro.observe(el.current!);
        return () => {
            ro.disconnect();
            m.remove();
            map.current = null;
        };
    }, []);

    useEffect(() => {
        const g = unitLayer.current;
        const m = map.current;
        if (!g || !m) return;
        g.clearLayers();
        for (const u of units) {
            L.marker([u.lat, u.lng], {
                icon: icon(u, u.imei === selected),
                zIndexOffset: u.imei === selected ? 1000 : u.tone === 'breakdown' ? 500 : 0,
            })
                .bindTooltip(
                    `<b>${escHtml(u.label)}</b> · ${escHtml(u.status)}${u.driver ? `<br>${escHtml(u.driver)}` : ''}`,
                    { direction: 'top', offset: [0, -12] },
                )
                .on('click', () => cb.current(u.imei))
                .addTo(g);
        }
        if (!fitted.current && units.length > 0) {
            fitted.current = true;
            const pts = [...units, ...sites].map((x) => [x.lat, x.lng] as [number, number]);
            m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
        }
    }, [units, sites, selected]);

    // Unit dipilih dari daftar: geser peta ke unit itu.
    useEffect(() => {
        const u = units.find((x) => x.imei === selected);
        if (u && map.current) map.current.panTo([u.lat, u.lng]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    useEffect(() => {
        if (siteLayer.current) drawSites(siteLayer.current, sites);
    }, [sites]);

    return <div ref={el} className="h-full min-h-[480px] w-full rounded-xl border" />;
}
