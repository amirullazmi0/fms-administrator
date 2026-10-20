'use client';
// Menu User: Staff (login dashboard: email + password + role) | Operator (driver / operator alat,
// user_type operator, login MDT pakai NIK + PIN). Operator dikelola lewat /api/drivers.
import { HardHat, UserCog } from 'lucide-react';
import { useQueryState } from 'nuqs';
import DriverManager from '@/components/fleet/DriverManager';
import { P, useCan } from '@/lib/permissions';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UsersView from './users.view';

export default function UserTabsView() {
    const can = useCan();
    const [tab, setTab] = useQueryState('tipe', { defaultValue: 'staff' });
    const operators = can(P.driverRead);

    return (
        <div className="flex flex-col">
            {operators && (
                <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6 md:pt-6">
                    <Tabs value={tab} onValueChange={(v) => void setTab(v)}>
                        <TabsList>
                            <TabsTrigger value="staff">
                                <UserCog /> Staff
                            </TabsTrigger>
                            <TabsTrigger value="operator">
                                <HardHat /> Operator
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}
            {tab === 'operator' && operators ? (
                <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
                    <DriverManager canEdit={can(P.driverCreate) || can(P.driverUpdate)} />
                </div>
            ) : (
                <UsersView />
            )}
        </div>
    );
}
