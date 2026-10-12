// GET /reports/visits: time at loading / unloading sites.
export interface DwellStats {
    visits: number;
    avgDwellMs: number;
    minDwellMs: number;
    maxDwellMs: number;
    totalMs: number;
    inside: number;
}

export interface SiteStay {
    imei: string;
    truck: string;
    driverName: string | null;
    routeName: string | null;
    siteName: string;
    role: 'loading' | 'unloading';
    arriveAt: number;
    dwellMs: number;
}

export interface SiteDwellRow {
    siteId: string;
    siteName: string;
    role: 'loading' | 'unloading';
    visits: number;
    avgDwellMs: number;
    maxDwellMs: number;
    inside: number;
}

export interface VisitReport {
    from: number;
    to: number;
    loading: DwellStats;
    unloading: DwellStats;
    sites: SiteDwellRow[];
    current: SiteStay[];
}
