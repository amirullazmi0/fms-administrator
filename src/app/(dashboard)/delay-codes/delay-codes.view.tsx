'use client';
// Master delay code: alasan status yang dipilih operator di MDT (P2H, Ishoma, Sholat, Antre, BD…).
// Kategori menentukan status unit: Operasi = working, Standby (terencana / tidak) = standby,
// Breakdown = breakdown. Dasar PA & UA.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { useToast } from '@/components/fleet/Toasts';
import { errText } from '@/lib/api-error';
import { DELAY_CATEGORY, DELAY_TONE } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Note,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/misc';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { DelayCategory, DelayCode } from '@/types/fleet';

interface Form {
    code: string;
    name: string;
    category: DelayCategory;
    icon: string;
    sort: string;
    active: boolean;
}

const ICONS = [
    'truck',
    'download',
    'upload',
    'undo',
    'clipboard-check',
    'utensils',
    'moon',
    'repeat',
    'shield',
    'list-ordered',
    'hourglass',
    'fuel',
    'cloud-rain',
    'construction',
    'radio',
    'cog',
    'circle-dot',
    'droplet',
    'zap',
    'wrench',
];

export default function DelayCodesView() {
    const toast = useToast();
    const [form, setForm] = useState<Form | null>(null);
    const [isNew, setIsNew] = useState(false);
    const list = useQueryApiRequest<GlobalApiResponse<DelayCode[]>>({
        key: 'delay-codes',
        queries: { all: true },
    });
    const save = useMutationApiRequest<GlobalApiResponse<DelayCode>, object>({
        key: 'delay-codes-upsert',
        config: SILENT,
    });
    const codes = list.data?.data ?? [];

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        try {
            await save.mutateAsync({
                code: form.code,
                name: form.name,
                category: form.category,
                icon: form.icon || null,
                sort: Number(form.sort) || 0,
                active: form.active,
            });
            toast({
                title: 'Delay code disimpan',
                body: `${form.code.toUpperCase()} · ${form.name}`,
            });
            setForm(null);
        } catch (err) {
            toast({ title: 'Gagal menyimpan', body: errText(err), level: 'crit' });
        }
    };

    return (
        <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2">
                <Note tone="info" className="flex-1">
                    Tombol di MDT operator diambil dari sini. Kode lama tidak dapat dihapus (dipakai
                    riwayat), cukup dinonaktifkan. Kode <b>Q_LOAD</b> / <b>Q_DUMP</b> dipakai alert
                    antrean.
                </Note>
                <Button
                    onClick={() => {
                        setIsNew(true);
                        setForm({
                            code: '',
                            name: '',
                            category: 'standby_unplanned',
                            icon: '',
                            sort: String((codes.at(-1)?.sort ?? 0) + 1),
                            active: true,
                        });
                    }}
                >
                    <Plus /> Delay code
                </Button>
            </div>
            <Card className="pb-1">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kode</TableHead>
                            <TableHead>Nama</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">Urutan</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {codes.map((c) => (
                            <TableRow key={c.code} className={cn(!c.active && 'opacity-50')}>
                                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                                <TableCell className="font-medium">
                                    {c.name} {!c.active && <Badge variant="muted">Nonaktif</Badge>}
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                                            DELAY_TONE[c.category],
                                        )}
                                    >
                                        {DELAY_CATEGORY[c.category]}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{c.sort}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Ubah ${c.name}`}
                                        onClick={() => {
                                            setIsNew(false);
                                            setForm({
                                                code: c.code,
                                                name: c.name,
                                                category: c.category,
                                                icon: c.icon ?? '',
                                                sort: String(c.sort),
                                                active: c.active,
                                            });
                                        }}
                                    >
                                        <Pencil />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

            <Dialog open={form != null} onOpenChange={(o) => !o && setForm(null)}>
                <DialogContent>
                    {form && (
                        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
                            <DialogHeader>
                                <DialogTitle>
                                    {isNew ? 'Delay code baru' : `Ubah ${form.code}`}
                                </DialogTitle>
                                <DialogDescription>
                                    Nama ini yang tampil di tombol MDT operator.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Kode" hint="Huruf besar, angka, _">
                                    <Input
                                        value={form.code}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                code: e.target.value
                                                    .toUpperCase()
                                                    .replace(/[^A-Z0-9_]/g, ''),
                                            })
                                        }
                                        maxLength={20}
                                        disabled={!isNew}
                                        className="font-mono"
                                        required
                                    />
                                </Field>
                                <Field label="Urutan">
                                    <Input
                                        type="number"
                                        min={0}
                                        value={form.sort}
                                        onChange={(e) => setForm({ ...form, sort: e.target.value })}
                                    />
                                </Field>
                            </div>
                            <Field label="Nama">
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    maxLength={100}
                                    required
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Kategori">
                                    <SimpleSelect
                                        value={form.category}
                                        onChange={(v) =>
                                            setForm({ ...form, category: v as DelayCategory })
                                        }
                                        options={(
                                            Object.keys(DELAY_CATEGORY) as DelayCategory[]
                                        ).map((k) => ({ value: k, label: DELAY_CATEGORY[k] }))}
                                    />
                                </Field>
                                <Field label="Ikon">
                                    <SimpleSelect
                                        value={form.icon}
                                        onChange={(v) => setForm({ ...form, icon: v })}
                                        options={ICONS.map((i) => ({ value: i, label: i }))}
                                        placeholder="(bawaan)"
                                    />
                                </Field>
                            </div>
                            <Label className="justify-between rounded-lg border p-3">
                                <span>Aktif (tampil di MDT)</span>
                                <Switch
                                    checked={form.active}
                                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                                />
                            </Label>
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
                                    disabled={!form.code || !form.name || save.isPending}
                                >
                                    Simpan
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
