import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const REQUIRE_ORGANIZATION_KEY = 'requireOrganization';
export const RequireOrganization = () => SetMetadata(REQUIRE_ORGANIZATION_KEY, true);

export const REQUIRE_WRITABLE_TENANT_KEY = 'requireWritableTenant';
export const RequireWritableTenant = () => SetMetadata(REQUIRE_WRITABLE_TENANT_KEY, true);

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditAction = (action: string, resource: string) =>
  SetMetadata(AUDIT_ACTION_KEY, { action, resource });

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const REQUIRE_STEP_UP_KEY = 'requireStepUp';
export const RequireStepUp = (minAcr = '1') => SetMetadata(REQUIRE_STEP_UP_KEY, minAcr);

export const IS_CUSTOMER_ROUTE_KEY = 'isCustomerRoute';
/** B2C customer JWT routes — use CustomerAuthGuard instead of staff ApplicationUser checks. */
export const CustomerRoute = () => SetMetadata(IS_CUSTOMER_ROUTE_KEY, true);

export const REQUIRE_MODULE_KEY = 'requireModule';
/** Requires the tenant plan (and feature flag) to enable the named product module. */
export const RequireModule = (moduleKey: string) => SetMetadata(REQUIRE_MODULE_KEY, moduleKey);

export const REQUIRE_CAPABILITY_KEY = 'requireCapability';
/** Requires the named business capability to be ENABLED on the active organization. */
export const RequiresCapability = (capabilityCode: string) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capabilityCode);

export const IS_EDGE_ROUTE_KEY = 'isEdgeRoute';
/** Okapi Edge Admin routes — skip ERP tenant JWT path; use EdgeAuthGuard instead. */
export const EdgeRoute = () => SetMetadata(IS_EDGE_ROUTE_KEY, true);

export const EDGE_PERMISSIONS_KEY = 'edgePermissions';
export const RequireEdgePermissions = (...permissions: string[]) =>
  SetMetadata(EDGE_PERMISSIONS_KEY, permissions);

export const REQUIRE_EDGE_WORKSPACE_KEY = 'requireEdgeWorkspace';
export const RequireEdgeWorkspace = () => SetMetadata(REQUIRE_EDGE_WORKSPACE_KEY, true);
