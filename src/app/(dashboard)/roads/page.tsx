'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

// The path preview uses Leaflet (browser only).
const RoadsView = dynamic(() => import('./roads.view'), {
    ssr: false,
    loading: () => <PageLoading />,
});

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <RoadsView />
        </Suspense>
    );
}
