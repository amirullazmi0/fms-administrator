'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

// Rendered on the client only (same as the other dashboard pages).
const TargetsView = dynamic(() => import('./targets.view'), {
    ssr: false,
    loading: () => <PageLoading />,
});

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <TargetsView />
        </Suspense>
    );
}
