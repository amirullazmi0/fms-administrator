import { MutationDataService } from '@/data-services/type';

export type ProductionMutationKeys =
    'targets-create' | 'targets-update' | 'targets-delete' | 'delay-codes-upsert' | 'drivers-pin';

export const productionMutations: MutationDataService<ProductionMutationKeys> = {
    'targets-create': {
        url: '/production-targets',
        method: 'POST',
        refetchQueries: ['production-targets', 'reports-hourly'],
    },
    'targets-update': {
        url: '/production-targets/:id',
        method: 'PUT',
        refetchQueries: ['production-targets', 'reports-hourly'],
    },
    'targets-delete': {
        url: '/production-targets/:id',
        method: 'DELETE',
        refetchQueries: ['production-targets', 'reports-hourly'],
    },
    'delay-codes-upsert': { url: '/delay-codes', method: 'PUT', refetchQueries: ['delay-codes'] },
    'drivers-pin': { url: '/drivers/:id/pin', method: 'PUT', refetchQueries: ['drivers'] },
};
