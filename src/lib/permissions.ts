// Permission names (same as fms-backend internal/model/permission.go). The UI hides what
// a role cannot do; the backend checks every request again.
import { useAuthStore } from '@/stores/auth.store';

export const P = {
    userReadAll: 'user.read_all',
    userCreate: 'user.create',
    userUpdate: 'user.update',
    userUpdateRole: 'user.update_role',
    userDelete: 'user.delete',
    roleRead: 'role.read',
    roleCreate: 'role.create',
    roleUpdate: 'role.update',
    roleDelete: 'role.delete',
    deviceRead: 'device.read',
    deviceUpdate: 'device.update',
    deviceDelete: 'device.delete',
    deviceCommand: 'device.command',
    logRead: 'log.read',
    siteRead: 'site.read',
    siteCreate: 'site.create',
    siteUpdate: 'site.update',
    siteDelete: 'site.delete',
    routeRead: 'route.read',
    routeCreate: 'route.create',
    routeUpdate: 'route.update',
    routeDelete: 'route.delete',
    driverRead: 'driver.read',
    driverCreate: 'driver.create',
    driverUpdate: 'driver.update',
    driverDelete: 'driver.delete',
    shiftTemplateRead: 'shift_template.read',
    shiftTemplateCreate: 'shift_template.create',
    shiftTemplateUpdate: 'shift_template.update',
    shiftTemplateDelete: 'shift_template.delete',
    shiftRead: 'shift.read',
    shiftCreate: 'shift.create',
    shiftUpdate: 'shift.update',
    shiftDelete: 'shift.delete',
    shiftOperate: 'shift.operate',
    assignmentManage: 'assignment.manage',
    reportRead: 'report.read',
    featureUpdate: 'feature.update',
    simulationRun: 'simulation.run',
    roadRead: 'road.read',
    roadDelete: 'road.delete',
} as const;

export type Permission = (typeof P)[keyof typeof P];

// Re-renders when the user changes.
export function useCan(): (permission: Permission) => boolean {
    const user = useAuthStore((s) => s.user);
    // Administrator users pass every check (same as the backend).
    return (permission) => Boolean(user?.is_administrator || user?.permissions?.includes(permission));
}
