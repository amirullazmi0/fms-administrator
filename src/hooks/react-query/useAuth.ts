'use client';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { useEffect, useRef } from 'react';
import useMutationApiRequest from './useMutationApiRequest';
import useQueryApiRequest from './useQueryApiRequest';
import { SESSION } from '@/lib/session';
import { useAuthStore } from '@/stores/auth.store';
import { GlobalApiResponse } from '@/types/api/responses';
import { AuthResponse, LoginRequest, User } from '@/types/auth';
import { toast } from 'sonner';

export const NOT_ADMIN = 'Akun ini bukan administrator. Pakai aplikasi FMS Supervisor.';

// The BFF keeps the tokens in httpOnly cookies; this readable flag only says a session exists
// (the BFF renews an expired access token from the refresh token on the next call).
export const hasSession = () => Boolean(Cookies.get(SESSION.flag));

export const useAuth = () => {
    const queryClient = useQueryClient();
    const { setUser, clearAuth } = useAuthStore();

    const login = useMutationApiRequest<GlobalApiResponse<AuthResponse>, LoginRequest>({
        key: 'login',
        config: { successNotification: false },
        options: {
            onSuccess: (res) => {
                const data = res?.data;
                // Non-administrators are refused by the BFF (403 + NOT_ADMIN), so here the user may enter.
                if (!data?.user) return;
                toast.success('Login berhasil');
                setUser(data.user);
                queryClient.setQueryData(['profile', undefined, undefined], {
                    success: true,
                    message: '',
                    data: data.user,
                });
                const redirect = new URLSearchParams(globalThis.window.location.search).get(
                    'redirect',
                );
                globalThis.window.location.href =
                    redirect && redirect.startsWith('/') ? redirect : '/';
            },
        },
    });

    // Local teardown runs whether or not the backend call succeeded.
    const finishLogout = () => {
        clearAuth();
        queryClient.clear();
        globalThis.window.location.href = '/auth/sign-in';
    };

    const logout = useMutationApiRequest<GlobalApiResponse<null>, void>({
        key: 'logout',
        config: { successNotification: false, errorNotification: false },
        options: { onSuccess: finishLogout, onError: finishLogout },
    });

    // Ref: the mutation object is new every render, it must not retrigger the effect below.
    const logoutRef = useRef(logout.mutate);
    useEffect(() => {
        logoutRef.current = logout.mutate;
    });

    const profile = useQueryApiRequest<GlobalApiResponse<User>>({
        key: 'profile',
        config: { errorNotification: false },
        options: { enabled: hasSession(), staleTime: 5 * 60 * 1000, retry: false },
    });

    // Keep the store in sync with the profile.
    useEffect(() => {
        const user = profile.data?.data;
        if (user && !user.admin_app) {
            // Access was taken away meanwhile: end the session (the BFF clears the cookies).
            toast.error(NOT_ADMIN);
            logoutRef.current();
            return;
        }
        if (user) {
            setUser(user);
        }
    }, [profile.data, setUser]);

    return { login, logout, profile, user: profile.data?.data ?? null };
};
