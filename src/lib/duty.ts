// Unit yang sedang bertugas: dari penugasan shift aktif di setiap rute (Route.onDuty).
import { useMemo } from 'react';
import { useData } from '@/provider/StreamProvider';

export interface Duty {
    shiftId: string;
    shiftName: string;
    driverId: string;
    driverName: string;
    routeId: string;
    routeName: string;
}

// imei -> tugasnya saat ini. Unit yang tidak ada di sini = tidak bertugas.
export function useDuty(): Map<string, Duty> {
    const { routes } = useData();
    return useMemo(() => {
        const m = new Map<string, Duty>();
        for (const r of routes) {
            for (const d of r.onDuty)
                m.set(d.imei, {
                    shiftId: d.shiftId,
                    shiftName: d.shiftName,
                    driverId: d.driverId,
                    driverName: d.driverName,
                    routeId: r.id,
                    routeName: r.name,
                });
        }
        return m;
    }, [routes]);
}
