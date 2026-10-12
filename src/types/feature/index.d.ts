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
    devices: number;
    interval: number;
    loop: boolean;
}

export interface SimulationStatus {
    enabled: boolean;
    running: boolean;
    devices: number;
    interval: number;
    started_at: number | null;
    started_by: string | null;
}
