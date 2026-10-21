import { QueriesDataService } from '@/data-services/type';

// Produksi per jam, target, kesegaran data, status unit, master delay code.
export type ProductionQueryKeys =
    | 'reports-hourly'
    | 'reports-freshness'
    | 'reports-stages'
    | 'production-targets'
    | 'delay-codes'
    | 'unit-status-current'
    | 'reports-heatmap';

export const productionQueries: QueriesDataService<ProductionQueryKeys> = {
    'reports-hourly': '/reports/hourly',
    'reports-freshness': '/reports/freshness',
    'reports-stages': '/reports/stages',
    'production-targets': '/production-targets',
    'delay-codes': '/delay-codes',
    'unit-status-current': '/unit-status/current',
    'reports-heatmap': '/reports/heatmap',
};
