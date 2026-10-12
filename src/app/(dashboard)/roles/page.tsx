'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import PageLoading from '@/components/custom/page-loading';

const RolesView = dynamic(() => import('./roles.view'), { ssr: false, loading: () => <PageLoading /> });

export default function Page() {
    return (
        <Suspense fallback={<PageLoading />}>
            <RolesView />
        </Suspense>
    );
}
