// fms-backend features table (menu Fitur) and the backend's truck simulator.
export interface Feature {
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    config: Record<string, unknown>;
    updated_at: number;
}

export interface SimulationConfig {
    devices: number; // all units
    interval: number;
    loop: boolean;
    // Of devices: EX, LV and SUPPORT; the rest are DT. Not set = default composition.
    excavators: number;
    lightVehicles: number;
    supports: number;
}

export interface SimulationStatus {
    enabled: boolean;
    running: boolean;
    devices: number;
    interval: number;
    started_at: number | null;
    started_by: string | null;
}
