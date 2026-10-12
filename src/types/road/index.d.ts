// fms-backend road data (menu Data jalan).
export interface RoadPathRow {
    id: string;
    from_lat: number;
    from_lng: number;
    to_lat: number;
    to_lng: number;
    from_site: string | null;
    to_site: string | null;
    point_count: number;
    distance_m: number;
    duration_s: number;
    created_at: number;
    last_used_at: number;
    coords?: [number, number][];
}

export interface RoadAreaRow {
    id: string;
    kind: 'major' | 'all';
    south: number;
    west: number;
    north: number;
    east: number;
    element_count: number;
    size_bytes: number;
    fetched_at: number;
}
