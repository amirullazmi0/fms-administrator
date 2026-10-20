'use client';
// Role & permission: list roles, create/edit with a permission checklist, delete.
import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { useToast } from '@/components/fleet/Toasts';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { P, useCan } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
    Empty,
    Note,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { Permission, Role } from '@/types/role';
import ModalUpsertRole from './components/modal-upsert.roles';

export default function RolesView() {
    const { setStats } = useLayout();
    const can = useCan();
    const toast = useToast();
    const roles = useQueryApiRequest<GlobalApiResponse<Role[]>>({ key: 'roles' });
    const permissions = useQueryApiRequest<GlobalApiResponse<Permission[]>>({
        key: 'permissions',
        options: { staleTime: Infinity },
    });
    const list = roles.data?.data ?? [];
    const catalogue = permissions.data?.data ?? [];
    const [editing, setEditing] = useState<Role | null>(null);
    const [open, setOpen] = useState(false);
    const [toDelete, setToDelete] = useState<Role | null>(null);
    const del = useMutationApiRequest<
        GlobalApiResponse<{ id: string }>,
        { __params: { id: string } }
    >({ key: 'roles-delete', config: SILENT });

    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Role" value={list.length} />
                <HeaderStat label="Permission" value={catalogue.length} />
            </>,
        );
    }, [setStats, list.length, catalogue.length]);
    useEffect(() => () => setStats(null), [setStats]);

    const remove = async (r: Role) => {
        try {
            await del.mutateAsync({ __params: { id: r.id } });
            toast({ title: 'Role dihapus', body: r.name, level: 'warn' });
        } catch (err) {
            toast({ title: 'Gagal menghapus', body: errText(err), level: 'crit' });
        }
    };

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Note tone="info" className="flex-1">
                    Role menentukan aksi yang boleh dilakukan user. User yang ditandai{' '}
                    <b>Administrator</b> (di menu User) lolos semua pemeriksaan tanpa melihat role.
                </Note>
                {can(P.roleCreate) && (
                    <Button
                        onClick={() => {
                            setEditing(null);
                            setOpen(true);
                        }}
                    >
                        <Plus /> Role
                    </Button>
                )}
            </div>

            <Card className="gap-0 py-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Role</TableHead>
                            <TableHead>Akses</TableHead>
                            <TableHead>Permission</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {list.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <span className="flex items-center gap-2">
                                        <b>{r.name}</b>
                                        {r.is_default && <Badge variant="info">Default</Badge>}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {r.is_administrator ? (
                                        <Badge variant="brand">fms-administrator</Badge>
                                    ) : (
                                        <Badge variant="muted">fms-supervisor</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[360px] whitespace-normal">
                                    <span className="text-xs text-muted-foreground">
                                        {r.permissions.length} / {catalogue.length}
                                        {r.permissions.length > 0 &&
                                            ` · ${r.permissions.slice(0, 4).join(', ')}${r.permissions.length > 4 ? '…' : ''}`}
                                    </span>
                                </TableCell>
                                <TableCell className="tabular-nums">{r.user_count ?? 0}</TableCell>
                                <TableCell className="text-right">
                                    <span className="inline-flex gap-1">
                                        {can(P.roleUpdate) && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => {
                                                    setEditing(r);
                                                    setOpen(true);
                                                }}
                                                aria-label={`Ubah ${r.name}`}
                                            >
                                                <Pencil />
                                            </Button>
                                        )}
                                        {can(P.roleDelete) && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-destructive hover:text-destructive"
                                                disabled={r.in_use || r.is_default}
                                                onClick={() => setToDelete(r)}
                                                aria-label={`Hapus ${r.name}`}
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
                {roles.isLoading && <Empty className="p-4">Memuat…</Empty>}
            </Card>

            <ModalUpsertRole
                open={open}
                role={editing}
                permissions={catalogue}
                onOpenChange={setOpen}
            />
            <ConfirmDialog
                open={toDelete != null}
                onOpenChange={(o) => !o && setToDelete(null)}
                title={`Hapus role ${toDelete?.name ?? ''}?`}
                description="Role yang masih dipakai user atau menjadi role default tidak dapat dihapus."
                confirmLabel="Hapus"
                destructive
                onConfirm={() => toDelete && void remove(toDelete)}
            />
        </div>
    );
}
