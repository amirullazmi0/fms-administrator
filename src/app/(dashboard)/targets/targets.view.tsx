'use client';
// Target produksi per rute (fleet): ritase & tonase per jam dan per shift. Target berlaku mulai
// tanggalnya sampai ada target yang lebih baru untuk rute yang sama.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { useToast } from '@/components/fleet/Toasts';
import { useData } from '@/provider/StreamProvider';
import { errText } from '@/lib/api-error';
import { dateKey, fmtDate, fmtNum } from '@/lib/format';
import { P, useCan } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
    ConfirmDialog,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import type { ProductionTarget } from '@/types/fleet';

interface Form {
    routeId: string;
    ritPerHour: string;
    tonPerHour: string;
    ritPerShift: string;
    tonPerShift: string;
    validFrom: string;
    note: string;
}

const empty = (): Form => ({
    routeId: '',
    ritPerHour: '',
    tonPerHour: '',
    ritPerShift: '',
    tonPerShift: '',
    validFrom: dateKey(),
    note: '',
});
const str = (v: number | null) => (v == null ? '' : String(v));
const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export default function TargetsView() {
    const toast = useToast();
    const can = useCan();
    const { routes } = useData();
    const [form, setForm] = useState<Form | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<ProductionTarget | null>(null);
    const list = useQueryApiRequest<GlobalApiResponse<ProductionTarget[]>>({
        key: 'production-targets',
    });
    const create = useMutationApiRequest<GlobalApiResponse<ProductionTarget>, object>({
        key: 'targets-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<ProductionTarget>, object>({
        key: 'targets-update',
        params: () => ({ id: editing ?? '' }),
        config: SILENT,
    });
    const del = useMutationApiRequest<
        GlobalApiResponse<{ id: string }>,
        { __params: { id: string } }
    >({ key: 'targets-delete', config: SILENT });
    const canEdit = can(P.targetManage);
    const targets = list.data?.data ?? [];

    const set = (k: keyof Form) => (e: { target: { value: string } }) =>
        form && setForm({ ...form, [k]: e.target.value });
    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form?.routeId) return;
        const body = {
            routeId: form.routeId,
            validFrom: form.validFrom,
            note: form.note.trim() || null,
            ritPerHour: numOrNull(form.ritPerHour),
            tonPerHour: numOrNull(form.tonPerHour),
            ritPerShift: numOrNull(form.ritPerShift),
            tonPerShift: numOrNull(form.tonPerShift),
        };
        try {
            if (editing) await update.mutateAsync(body);
            else await create.mutateAsync(body);
            toast({
                title: 'Target disimpan',
                body: routes.find((r) => r.id === form.routeId)?.name ?? '',
            });
            setForm(null);
            setEditing(null);
        } catch (err) {
            toast({ title: 'Gagal nyimpen target', body: errText(err), level: 'crit' });
        }
    };

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2">
                <Note tone="info" className="flex-1">
                    Target dipakai di <b>Produksi per jam</b> (pencapaian %) dan di layar MDT
                    operator (target per shift). Pakai target tonase kalau ada; kalau kosong,
                    pencapaian dihitung dari ritase.
                </Note>
                {canEdit && (
                    <Button
                        onClick={() => {
                            setEditing(null);
                            setForm(empty());
                        }}
                    >
                        <Plus /> Target
                    </Button>
                )}
            </div>
            <Card className="pb-1">
                {targets.length === 0 ? (
                    <Empty className="p-4">
                        Belum ada target. Tanya manajemen target ritase / tonase per jam tiap fleet.
                    </Empty>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Rute / fleet</TableHead>
                                <TableHead>Berlaku mulai</TableHead>
                                <TableHead className="text-right">Rit / jam</TableHead>
                                <TableHead className="text-right">Ton / jam</TableHead>
                                <TableHead className="text-right">Rit / shift</TableHead>
                                <TableHead className="text-right">Ton / shift</TableHead>
                                <TableHead>Catatan</TableHead>
                                {canEdit && <TableHead />}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {targets.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.routeName}</TableCell>
                                    <TableCell>{fmtDate(t.validFrom)}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {t.ritPerHour != null ? fmtNum(t.ritPerHour, 1) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {t.tonPerHour != null ? fmtNum(t.tonPerHour) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {t.ritPerShift != null ? fmtNum(t.ritPerShift) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {t.tonPerShift != null ? fmtNum(t.tonPerShift) : '—'}
                                    </TableCell>
                                    <TableCell className="max-w-56 truncate text-muted-foreground">
                                        {t.note ?? ''}
                                    </TableCell>
                                    {canEdit && (
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Ubah target"
                                                onClick={() => {
                                                    setEditing(t.id);
                                                    setForm({
                                                        routeId: t.routeId,
                                                        ritPerHour: str(t.ritPerHour),
                                                        tonPerHour: str(t.tonPerHour),
                                                        ritPerShift: str(t.ritPerShift),
                                                        tonPerShift: str(t.tonPerShift),
                                                        validFrom: t.validFrom,
                                                        note: t.note ?? '',
                                                    });
                                                }}
                                            >
                                                <Pencil />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-destructive"
                                                aria-label="Hapus target"
                                                onClick={() => setToDelete(t)}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <Dialog open={form != null} onOpenChange={(o) => !o && setForm(null)}>
                <DialogContent>
                    {form && (
                        <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
                            <DialogHeader>
                                <DialogTitle>{editing ? 'Ubah target' : 'Target baru'}</DialogTitle>
                                <DialogDescription>Kosongkan yang nggak dipakai.</DialogDescription>
                            </DialogHeader>
                            <Field label="Rute / fleet">
                                <Combobox
                                    value={form.routeId}
                                    onChange={(v) => setForm({ ...form, routeId: v })}
                                    options={routes.map((r) => ({ value: r.id, label: r.name }))}
                                    placeholder="Pilih rute"
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Ritase / jam">
                                    <Input
                                        inputMode="decimal"
                                        value={form.ritPerHour}
                                        onChange={set('ritPerHour')}
                                    />
                                </Field>
                                <Field label="Tonase / jam">
                                    <Input
                                        inputMode="decimal"
                                        value={form.tonPerHour}
                                        onChange={set('tonPerHour')}
                                    />
                                </Field>
                                <Field label="Ritase / shift">
                                    <Input
                                        inputMode="decimal"
                                        value={form.ritPerShift}
                                        onChange={set('ritPerShift')}
                                    />
                                </Field>
                                <Field label="Tonase / shift">
                                    <Input
                                        inputMode="decimal"
                                        value={form.tonPerShift}
                                        onChange={set('tonPerShift')}
                                    />
                                </Field>
                            </div>
                            <Field label="Berlaku mulai">
                                <Input
                                    type="date"
                                    value={form.validFrom}
                                    onChange={set('validFrom')}
                                    required
                                />
                            </Field>
                            <Field label="Catatan">
                                <Input value={form.note} onChange={set('note')} maxLength={200} />
                            </Field>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setForm(null)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!form.routeId || create.isPending || update.isPending}
                                >
                                    Simpan
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={toDelete != null}
                onOpenChange={(o) => !o && setToDelete(null)}
                title={`Hapus target ${toDelete?.routeName ?? ''}?`}
                description="Pencapaian di jam-jam yang memakai target ini jadi kosong (kecuali ada target lain yang berlaku)."
                confirmLabel="Hapus"
                destructive
                onConfirm={() =>
                    toDelete &&
                    del
                        .mutateAsync({ __params: { id: toDelete.id } })
                        .catch((err) =>
                            toast({ title: 'Gagal ngehapus', body: errText(err), level: 'crit' }),
                        )
                }
            />
        </div>
    );
}
