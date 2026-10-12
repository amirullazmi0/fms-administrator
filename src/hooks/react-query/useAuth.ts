'use client';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { useEffect } from 'react';
import useMutationApiRequest from './useMutationApiRequest';
import useQueryApiRequest from './useQueryApiRequest';
import { setAuthCookies, setUserRoleCookie, clearAuthCookies } from '@/lib/auth-sync';
import { useAuthStore } from '@/stores/auth.store';
import { GlobalApiResponse } from '@/types/api/responses';
import { axiosInstance } from '@/lib/axios';
import { toast } from 'sonner';

export const NOT_ADMIN = 'Akun ini bukan administrator. Pakai aplikasi FMS Supervisor.';
import { AuthResponse, LoginRequest, User } from '@/types/auth';

/**
 * A session survives an expired access token: the axios interceptor renews it from the
 * refresh token mid-request. Checking only the access token would report a live session
 * as logged out and skip the call that triggers the renewal.
 */
export const hasSession = () => Boolean(Cookies.get('admAccessToken') || Cookies.get('admRefreshToken'));

export const useAuth = () => {
    const queryClient = useQueryClient();
    const { setUser, clearAuth } = useAuthStore();

    const login = useMutationApiRequest<GlobalApiResponse<AuthResponse>, LoginRequest>({
        key: 'login',
        config: { successNotification: false },
        options: {
            onSuccess: (res) => {
                const data = res?.data;
                if (!data?.access_token) return;
                // fms-administrator is for administrators and roles allowed in (e.g. OWNER).
                if (!data.user.admin_app) {
                    void axiosInstance
                        .post('/auth/logout', undefined, { headers: { Authorization: `Bearer ${data.access_token}` } })
                        .catch(() => {});
                    toast.error(NOT_ADMIN);
                    return;
                }
                toast.success('Login berhasil');
                setAuthCookies(data.access_token, data.refresh_token, data.expires_in);
                setUserRoleCookie(data.user.role);
                setUser(data.user);
                queryClient.setQueryData(['profile', undefined, undefined], { success: true, message: '', data: data.user });
                const redirect = new URLSearchParams(globalThis.window.location.search).get('redirect');
                globalThis.window.location.href = redirect && redirect.startsWith('/') ? redirect : '/';
            },
        },
    });

    // Local teardown runs whether or not the backend call succeeded.
    const finishLogout = () => {
        clearAuth();
        clearAuthCookies();
        queryClient.clear();
        globalThis.window.location.href = '/auth/sign-in';
    };

    const logout = useMutationApiRequest<GlobalApiResponse<null>, void>({
        key: 'logout',
        config: { successNotification: false, errorNotification: false },
        options: { onSuccess: finishLogout, onError: finishLogout },
    });

    const profile = useQueryApiRequest<GlobalApiResponse<User>>({
        key: 'profile',
        config: { errorNotification: false },
        options: { enabled: hasSession(), staleTime: 5 * 60 * 1000, retry: false },
    });

    // Keep the store (and the role cookie used by proxy.ts) in sync with the profile.
    useEffect(() => {
        const user = profile.data?.data;
        if (user && !user.admin_app) {
            toast.error(NOT_ADMIN);
            finishLogout();
            return;
        }
        if (user) {
            setUser(user);
            if (Cookies.get('admUserRole') !== user.role) setUserRoleCookie(user.role);
        }
    }, [profile.data, setUser]);

    return { login, logout, profile, user: profile.data?.data ?? null };
};
