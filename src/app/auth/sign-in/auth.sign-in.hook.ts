'use client';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { NOT_ADMIN, useAuth } from '@/hooks/react-query/useAuth';
import { apiErrorMessage } from '@/lib/api-error';
import { SignInSchema, SignInFormData } from './auth.sign-in.config';

export function useSignIn() {
    const { login } = useAuth();
    const {
        handleSubmit,
        register,
        formState: { errors },
    } = useForm<SignInFormData>({
        resolver: yupResolver(SignInSchema) as unknown as Resolver<SignInFormData>,
        mode: 'onBlur',
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = (data: SignInFormData) => login.mutate(data);

    return {
        register,
        errors,
        handleSubmit: handleSubmit(onSubmit),
        // A login that succeeded but is not allowed here does not redirect.
        isSubmitting: login.isPending || Boolean(login.isSuccess && login.data?.data?.user.admin_app),
        error: login.isError
            ? apiErrorMessage(login.error, 'Login gagal')
            : login.isSuccess && login.data?.data && !login.data.data.user.admin_app
              ? NOT_ADMIN
              : null,
    };
}
