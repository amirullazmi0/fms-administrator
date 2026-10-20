import * as yup from 'yup';

// One schema for create and edit: on edit the email is fixed and an empty password keeps the old one.
export const UserSchema = (isEdit: boolean) =>
    yup.object().shape({
        name: yup.string().trim().max(60, 'Nama maksimal 60 karakter').default(''),
        email: yup.string().trim().required('Email wajib diisi').email('Format email tidak valid'),
        password: isEdit
            ? yup
                  .string()
                  .default('')
                  .test('len', 'Password minimal 8 karakter', (v) => !v || v.length >= 8)
            : yup.string().required('Password wajib diisi').min(8, 'Password minimal 8 karakter'),
        role_id: yup.string().default(''),
        is_administrator: yup.boolean().default(false),
        is_active: yup.boolean().default(true),
    });

export type UserFormData = {
    name: string;
    email: string;
    password: string;
    role_id: string;
    is_administrator: boolean;
    is_active: boolean;
};
