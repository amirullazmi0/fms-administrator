export interface Permission {
    id: string;
    name: string;
    description: string | null;
}

export interface Role {
    id: string;
    name: string;
    is_default: boolean;
    is_administrator: boolean; // the role may open fms-administrator
    permissions: string[];
    created_at: number;
    updated_at: number;
    user_count?: number;
    in_use?: boolean;
}
