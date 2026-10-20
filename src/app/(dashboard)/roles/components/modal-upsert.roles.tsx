'use client';
// Role dialog: name, default / administrator-app switches, permission checklist per group.
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useToast } from '@/components/fleet/Toasts';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { Permission, Role } from '@/types/role';

// Group labels for permission prefixes.
const GROUPS: Record<string, string> = {
    device: 'Unit & live',
    log: 'Log alat',
    site: 'Titik',
    route: 'Rute',
    driver: 'Operator',
    shift_template: 'Template shift',
    shift: 'Shift',
    assignment: 'Penugasan',
    report: 'Laporan',
    user: 'User',
    role: 'Role & permission',
};

interface Form {
    name: string;
    is_default: boolean;
    is_administrator: boolean;
    permissions: Set<string>;
}

export default function ModalUpsertRole({
    open,
    role,
    permissions,
    onOpenChange,
}: {
    open: boolean;
    role: Role | null;
    permissions: Permission[];
    onOpenChange: (o: boolean) => void;
}) {
    const toast = useToast();
    const isEdit = role != null;
    const [form, setForm] = useState<Form>({
        name: '',
        is_default: false,
        is_administrator: false,
        permissions: new Set(),
    });
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setNameError(null);
        setForm({
            name: role?.name ?? '',
            is_default: role?.is_default ?? false,
            is_administrator: role?.is_administrator ?? false,
            permissions: new Set(role?.permissions ?? []),
        });
    }, [open, role]);

    const groups = useMemo(() => {
        const m = new Map<string, Permission[]>();
        for (const p of permissions) {
            const prefix = p.name.split('.')[0];
            m.set(prefix, [...(m.get(prefix) ?? []), p]);
        }
        return [...m.entries()].sort(
            (a, b) => Object.keys(GROUPS).indexOf(a[0]) - Object.keys(GROUPS).indexOf(b[0]),
        );
    }, [permissions]);

    const toggle = (names: string[], on: boolean) =>
        setForm((f) => {
            const next = new Set(f.permissions);
            names.forEach((n) => (on ? next.add(n) : next.delete(n)));
            return { ...f, permissions: next };
        });

    const create = useMutationApiRequest<GlobalApiResponse<Role>, object>({
        key: 'roles-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<Role>, object>({
        key: 'roles-update',
        params: () => ({ id: role?.id ?? '' }),
        config: SILENT,
    });

    const save = async (e: FormEvent) => {
        e.preventDefault();
        const name = form.name.trim();
        if (name.length < 3) {
            setNameError('Nama role minimal 3 karakter');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name,
                is_default: form.is_default,
                is_administrator: form.is_administrator,
                permissions: [...form.permissions],
            };
            if (isEdit) await update.mutateAsync(body);
            else await create.mutateAsync(body);
            toast({
                title: isEdit ? 'Role diubah' : 'Role dibuat',
                body: `${name} · ${form.permissions.size} permission`,
            });
            onOpenChange(false);
        } catch (err) {
            toast({ title: 'Gagal nyimpen role', body: errText(err), level: 'crit' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-3xl">
                <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={(e) => void save(e)}>
                    <DialogHeader>
                        <DialogTitle>
                            {isEdit ? `Ubah role ${role?.name}` : 'Role baru'}
                        </DialogTitle>
                        <DialogDescription>
                            Centang apa aja yang boleh dilakuin role ini. User administrator selalu
                            lolos tanpa dicek.
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Nama role" error={nameError}>
                        <Input
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value.toUpperCase() })
                            }
                            maxLength={100}
                            autoComplete="off"
                            autoFocus
                            placeholder="mis. DISPATCHER"
                        />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Label className="justify-between rounded-lg border p-3">
                            <span className="flex flex-col gap-1">
                                <span>Role default</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    Dipakai kalau user baru dibikin tanpa pilih role.
                                </span>
                            </span>
                            <Switch
                                checked={form.is_default}
                                onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                            />
                        </Label>
                        <Label className="justify-between rounded-lg border p-3">
                            <span className="flex flex-col gap-1">
                                <span>Boleh masuk fms-administrator</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    Mis. OWNER buat lihat laporan. Aksesnya tetap sesuai permission.
                                </span>
                            </span>
                            <Switch
                                checked={form.is_administrator}
                                onCheckedChange={(v) => setForm({ ...form, is_administrator: v })}
                            />
                        </Label>
                    </div>

                    <div className="grid min-h-0 flex-1 content-start items-start gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
                        {groups.map(([prefix, list]) => {
                            const names = list.map((p) => p.name);
                            const all = names.every((n) => form.permissions.has(n));
                            const some = !all && names.some((n) => form.permissions.has(n));
                            return (
                                <fieldset
                                    key={prefix}
                                    className="flex flex-col gap-2 rounded-xl border p-3"
                                >
                                    <legend className="sr-only">{GROUPS[prefix] ?? prefix}</legend>
                                    <Label className="justify-between">
                                        <b className="text-sm">{GROUPS[prefix] ?? prefix}</b>
                                        <Checkbox
                                            checked={all ? true : some ? 'indeterminate' : false}
                                            onCheckedChange={(v) => toggle(names, v === true)}
                                            aria-label={`Semua ${GROUPS[prefix] ?? prefix}`}
                                        />
                                    </Label>
                                    {list.map((p) => (
                                        <Label
                                            key={p.id}
                                            className="items-start gap-2.5 font-normal"
                                        >
                                            <Checkbox
                                                className="mt-0.5"
                                                checked={form.permissions.has(p.name)}
                                                onCheckedChange={(v) =>
                                                    toggle([p.name], v === true)
                                                }
                                            />
                                            <span className="flex flex-col gap-0.5">
                                                <span className="font-mono text-xs">{p.name}</span>
                                                {p.description && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {p.description}
                                                    </span>
                                                )}
                                            </span>
                                        </Label>
                                    ))}
                                </fieldset>
                            );
                        })}
                    </div>

                    <DialogFooter className="shrink-0 border-t pt-4 sm:items-center sm:justify-between">
                        <span className="text-xs text-muted-foreground">
                            {form.permissions.size} dari {permissions.length} permission
                        </span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Bikin role'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
