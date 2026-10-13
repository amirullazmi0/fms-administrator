'use client';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import useQueryApiRequest from '@/hooks/react-query/useQueryApiRequest';
import { useDebounce } from '@/hooks/useDebounce';
import type { GlobalApiResponse } from '@/types/api/responses';
import type { User } from '@/types/auth';
import type { Role } from '@/types/role';

export const PAGE_SIZE = 10;

export function useUserList() {
    const [params, setParams] = useQueryStates({
        page: parseAsInteger.withDefault(1),
        search: parseAsString.withDefault(''),
    });
    const search = useDebounce(params.search, 400);

    const users = useQueryApiRequest<GlobalApiResponse<User[]>>({
        key: 'users',
        queries: { page: params.page, limit: PAGE_SIZE, search, sort: 'created_at', order: 'desc' },
        options: { placeholderData: (prev) => prev },
    });
    const roles = useQueryApiRequest<GlobalApiResponse<Role[]>>({
        key: 'roles',
        config: { errorNotification: false },
    });

    return {
        users: users.data?.data ?? [],
        meta: users.data?.meta,
        loading: users.isLoading,
        roles: roles.data?.data ?? [],
        search: params.search,
        setSearch: (v: string) => setParams({ search: v, page: 1 }),
        setPage: (page: number) => setParams({ page }),
    };
}
