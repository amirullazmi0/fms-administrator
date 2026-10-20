'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useToast } from '@/components/fleet/Toasts';
import useMutationApiRequest, { SILENT } from '@/hooks/react-query/useMutationApiRequest';
import { errText } from '@/lib/api-error';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { User } from '@/types/auth';
import { UserFormData, UserSchema } from '../config/config.users';

const empty: UserFormData = {
    name: '',
    email: '',
    password: '',
    role_id: '',
    is_administrator: false,
    is_active: true,
};

export function useUpsertUser(user: User | null, open: boolean, onDone: () => void) {
    const toast = useToast();
    const isEdit = user != null;
    const form = useForm<UserFormData>({
        resolver: yupResolver(UserSchema(isEdit)) as unknown as Resolver<UserFormData>,
        mode: 'onBlur',
        defaultValues: empty,
    });

    // Fill the form each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        form.reset(
            user
                ? {
                      name: user.name ?? '',
                      email: user.email,
                      password: '',
                      role_id: user.role_id,
                      is_administrator: user.is_administrator,
                      is_active: user.is_active,
                  }
                : empty,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, user]);

    const create = useMutationApiRequest<GlobalApiResponse<{ id: string }>, object>({
        key: 'users-create',
        config: SILENT,
    });
    const update = useMutationApiRequest<GlobalApiResponse<{ id: string }>, object>({
        key: 'users-update',
        params: () => ({ id: user?.id ?? '' }),
        config: SILENT,
    });
    const setRole = useMutationApiRequest<GlobalApiResponse<{ id: string }>, { role_id: string }>({
        key: 'users-update-role',
        params: () => ({ id: user?.id ?? '' }),
        config: SILENT,
    });

    const onSubmit = async (v: UserFormData) => {
        try {
            if (!isEdit) {
                await create.mutateAsync({
                    email: v.email.trim(),
                    password: v.password,
                    name: v.name.trim() || undefined,
                    role_id: v.role_id || undefined, // empty = default role
                    is_administrator: v.is_administrator,
                });
                toast({ title: 'User dibuat', body: v.email });
            } else {
                await update.mutateAsync({
                    name: v.name.trim(),
                    is_active: v.is_active,
                    ...(v.password ? { password: v.password } : {}),
                    ...(v.is_administrator !== user.is_administrator
                        ? { is_administrator: v.is_administrator }
                        : {}),
                });
                if (v.role_id && v.role_id !== user.role_id)
                    await setRole.mutateAsync({ role_id: v.role_id });
                toast({ title: 'User diubah', body: v.email });
            }
            onDone();
        } catch (err) {
            toast({
                title: isEdit ? 'Gagal mengubah user' : 'Gagal membuat user',
                body: errText(err),
                level: 'crit',
            });
        }
    };

    return {
        form,
        isEdit,
        submit: form.handleSubmit(onSubmit),
        saving: form.formState.isSubmitting,
    };
}
