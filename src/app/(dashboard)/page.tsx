import { redirect } from 'next/navigation';

// "/" is redirected to /reports in next.config.ts (no prerender redirect); this is the fallback.
export default function Home() {
    redirect('/reports');
}
