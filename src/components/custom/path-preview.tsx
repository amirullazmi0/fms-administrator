'use client';
// Small Leaflet map showing one stored road path (start = green, end = orange).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBasemap } from '@/lib/basemap';

export default function PathPreview({ coords, className = 'h-72 w-full' }: { coords: [number, number][]; className?: string }) {
    const el = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!el.current || coords.length < 2) return;
        const m = L.map(el.current, { zoomControl: true, attributionControl: false });
        addBasemap(m);
        L.polyline(coords, { color: '#ffffff', weight: 8, opacity: 0.9 }).addTo(m);
        const line = L.polyline(coords, { color: '#2f6fe4', weight: 4 }).addTo(m);
        L.circleMarker(coords[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#16a34a', fillOpacity: 1 }).bindTooltip('Dari').addTo(m);
        L.circleMarker(coords[coords.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#e07b00', fillOpacity: 1 }).bindTooltip('Ke').addTo(m);
        m.fitBounds(line.getBounds(), { padding: [24, 24] });
        return () => {
            m.remove();
        };
    }, [coords]);
    return <div ref={el} className={`overflow-hidden rounded-lg border ${className}`} />;
}
