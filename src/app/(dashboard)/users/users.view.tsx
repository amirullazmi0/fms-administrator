'use client';
// User: list (search, paging), create/edit dialog, delete. Administrator users pass every check.
import { useEffect, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import Pager from '@/components/custom/pager';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { ago } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
    Avatar,
    Empty,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { User } from '@/types/auth';
import ModalUpsertUser from './components/modal-upsert.users';
import { useUserList } from './hooks/use-list.users';

export default function UsersView() {
    const { users, meta, loading, roles, search, setSearch, setPage } = useUserList();
    const { setStats } = useLayout();
    const can = useCan();
    const me = useAuthStore((s) => s.user);
    const toast = useToast();
    const [editing, setEditing] = useState<User | null>(null);
    const [open, setOpen] = useState(false);
    const [toDelete, setToDelete] = useState<User | null>(null);
    const del = useMutationApiRequest<
        GlobalApiResponse<{ id: string }>,
        { __params: { id: string } }
    >({ key: 'users-delete', config: SILENT });

    useEffect(() => {
        setStats(<HeaderStat label="User" value={meta?.total_data ?? '—'} />);
    }, [setStats, meta?.total_data]);
    useEffect(() => () => setStats(null), [setStats]);

    const remove = async (u: User) => {
        try {
            await del.mutateAsync({ __params: { id: u.id } });
            toast({ title: 'User dihapus', body: u.email, level: 'warn' });
        } catch (err) {
            toast({ title: 'Gagal ngehapus', body: errText(err), level: 'crit' });
        }
    };

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    className="min-w-60 flex-1"
                    placeholder="Cari nama, email, atau role…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Cari user"
                />
                {can(P.userCreate) && (
                    <Button
                        onClick={() => {
                            setEditing(null);
                            setOpen(true);
                        }}
                    >
                        <Plus /> User
                    </Button>
                )}
            </div>

            <Card className="gap-0 py-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Login terakhir</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell>
                                    <span className="flex items-center gap-3">
                                        <Avatar name={u.name || u.email} />
                                        <span className="flex min-w-0 flex-col">
                                            <b className="truncate">{u.name || '—'}</b>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {u.email}
                                            </span>
                                        </span>
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        {u.is_administrator && (
                                            <Badge variant="brand">
                                                <ShieldCheck className="size-3" /> Administrator
                                            </Badge>
                                        )}
                                        <Badge variant="outline">{u.role}</Badge>
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {u.is_active ? (
                                        <Badge variant="success">Aktif</Badge>
                                    ) : (
                                        <Badge variant="muted">Nonaktif</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {ago(u.last_login_at)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <span className="inline-flex gap-1">
                                        {(can(P.userUpdate) || can(P.userUpdateRole)) && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => {
                                                    setEditing(u);
                                                    setOpen(true);
                                                }}
                                                aria-label={`Ubah ${u.email}`}
                                            >
                                                <Pencil />
                                            </Button>
                                        )}
                                        {can(P.userDelete) && u.id !== me?.id && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => setToDelete(u)}
                                                aria-label={`Hapus ${u.email}`}
                                            >
                                                <Trash2 />
                                            </Button>
                                        )}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {!loading && users.length === 0 && (
                    <Empty className="p-4">
                        {search ? 'Nggak ada user yang cocok.' : 'Belum ada user.'}
                    </Empty>
                )}
                {loading && <Empty className="p-4">Memuat…</Empty>}
            </Card>
            <Pager meta={meta} onPage={setPage} />

            <ModalUpsertUser open={open} user={editing} roles={roles} onOpenChange={setOpen} />
            <ConfirmDialog
                open={toDelete != null}
                onOpenChange={(o) => !o && setToDelete(null)}
                title={`Hapus ${toDelete?.email ?? 'user'}?`}
                description="User ini nggak bisa login lagi. Riwayat shift yang dia bikin tetap disimpan."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => toDelete && void remove(toDelete)}
            />
        </div>
    );
}
