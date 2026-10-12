import { MutationDataService } from '@/data-services/type';

export type AdminMutationKeys =
    | 'users-create'
    | 'users-update'
    | 'users-update-role'
    | 'users-delete'
    | 'roles-create'
    | 'roles-update'
    | 'roles-delete'
    | 'features-update'
    | 'simulation-start'
    | 'simulation-stop'
    | 'road-paths-delete'
    | 'road-paths-delete-all'
    | 'road-areas-delete'
    | 'road-areas-delete-all';

export const adminMutations: MutationDataService<AdminMutationKeys> = {
    'users-create': { url: '/users', method: 'POST', refetchQueries: ['users', 'roles'] },
    'users-update': { url: '/users/:id', method: 'PUT', refetchQueries: ['users'] },
    'users-update-role': { url: '/users/:id/role', method: 'PUT', refetchQueries: ['users', 'roles'] },
    'users-delete': { url: '/users/:id', method: 'DELETE', refetchQueries: ['users', 'roles'] },
    'roles-create': { url: '/roles', method: 'POST', refetchQueries: ['roles'] },
    'roles-update': { url: '/roles/:id', method: 'PUT', refetchQueries: ['roles', 'users'] },
    'roles-delete': { url: '/roles/:id', method: 'DELETE', refetchQueries: ['roles'] },
    'features-update': { url: '/features/:key', method: 'PUT', refetchQueries: ['features', 'simulation'] },
    'simulation-start': { url: '/simulation/start', method: 'POST', refetchQueries: ['simulation'] },
    'simulation-stop': { url: '/simulation/stop', method: 'POST', refetchQueries: ['simulation'] },
    'road-paths-delete': { url: '/road-data/paths/:id', method: 'DELETE', refetchQueries: ['road-paths'] },
    'road-paths-delete-all': { url: '/road-data/paths', method: 'DELETE', refetchQueries: ['road-paths'] },
    'road-areas-delete': { url: '/road-data/areas/:id', method: 'DELETE', refetchQueries: ['road-areas'] },
    'road-areas-delete-all': { url: '/road-data/areas', method: 'DELETE', refetchQueries: ['road-areas'] },
};
