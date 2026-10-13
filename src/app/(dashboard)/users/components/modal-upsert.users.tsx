'use client';
import { Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/checkbox';
import { SimpleSelect } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Note } from '@/components/ui/misc';
import { useAuthStore } from '@/stores/auth.store';
import type { User } from '@/types/auth';
import type { Role } from '@/types/role';
import { useUpsertUser } from '../hooks/use-upsert.users';

export default function ModalUpsertUser({
    open,
    user,
    roles,
    onOpenChange,
}: {
    open: boolean;
    user: User | null;
    roles: Role[];
    onOpenChange: (o: boolean) => void;
}) {
    const me = useAuthStore((s) => s.user);
    const { form, isEdit, submit, saving } = useUpsertUser(user, open, () => onOpenChange(false));
    const {
        register,
        control,
        watch,
        formState: { errors },
    } = form;
    const isAdmin = watch('is_administrator');
    const self = user?.id === me?.id;
    const defaultRole = roles.find((r) => r.is_default);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? 'Ubah user' : 'User baru'}</DialogTitle>
                        <DialogDescription>
                            {isEdit
                                ? user?.email
                                : 'Akun buat masuk fms-supervisor / fms-administrator.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Field label="Nama" error={errors.name?.message}>
                        <Input {...register('name')} maxLength={60} autoComplete="off" autoFocus />
                    </Field>
                    <Field label="Email" error={errors.email?.message}>
                        <Input
                            type="email"
                            {...register('email')}
                            disabled={isEdit}
                            autoComplete="off"
                        />
                    </Field>
                    <Field
                        label={isEdit ? 'Password baru' : 'Password'}
                        hint={isEdit ? 'Kosongin kalau nggak diganti.' : 'Minimal 8 karakter.'}
                        error={errors.password?.message}
                    >
                        <Input
                            type="password"
                            {...register('password')}
                            autoComplete="new-password"
                        />
                    </Field>

                    {me?.is_administrator && (
                        <Controller
                            control={control}
                            name="is_administrator"
                            render={({ field }) => (
                                <Label className="justify-between rounded-lg border p-3">
                                    <span className="flex flex-col gap-1">
                                        <span>Administrator</span>
                                        <span className="text-xs font-normal text-muted-foreground">
                                            Lolos semua cek role &amp; permission, dan bisa masuk
                                            fms-administrator.
                                        </span>
                                    </span>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={self && field.value}
                                    />
                                </Label>
                            )}
                        />
                    )}

                    <Field
                        label="Role"
                        hint={
                            isAdmin
                                ? undefined
                                : !isEdit && defaultRole
                                  ? `Kosong = role default (${defaultRole.name}).`
                                  : undefined
                        }
                    >
                        <Controller
                            control={control}
                            name="role_id"
                            render={({ field }) => (
                                <SimpleSelect
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={roles.map((r) => ({ value: r.id, label: r.name }))}
                                    placeholder={
                                        defaultRole
                                            ? `${defaultRole.name} (default)`
                                            : 'Pilih role…'
                                    }
                                    aria-label="Role"
                                />
                            )}
                        />
                    </Field>
                    {isAdmin && (
                        <Note tone="info">
                            User administrator nggak dicek role &amp; permission-nya lagi, pasti
                            lolos. Role tetap dicatat buat tampilan.
                        </Note>
                    )}

                    {isEdit && (
                        <Controller
                            control={control}
                            name="is_active"
                            render={({ field }) => (
                                <Label className="justify-between rounded-lg border p-3">
                                    <span className="flex flex-col gap-1">
                                        <span>Aktif</span>
                                        <span className="text-xs font-normal text-muted-foreground">
                                            User nonaktif nggak bisa login, sesinya langsung
                                            diputus.
                                        </span>
                                    </span>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={self}
                                    />
                                </Label>
                            )}
                        />
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Bikin user'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
