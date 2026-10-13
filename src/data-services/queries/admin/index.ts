import { QueriesDataService } from '@/data-services/type';

export type AdminQueryKeys =
    | 'users'
    | 'roles'
    | 'roles-by-id'
    | 'permissions'
    | 'features'
    | 'simulation'
    | 'road-paths'
    | 'road-paths-by-id'
    | 'road-areas';

export const adminQueries: QueriesDataService<AdminQueryKeys> = {
    users: '/users',
    roles: '/roles',
    'roles-by-id': '/roles/:id',
    permissions: '/permissions',
    features: '/features',
    simulation: '/simulation',
    'road-paths': '/road-data/paths',
    'road-paths-by-id': '/road-data/paths/:id',
    'road-areas': '/road-data/areas',
};
