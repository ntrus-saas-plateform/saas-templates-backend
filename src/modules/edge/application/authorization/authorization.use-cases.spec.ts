import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { EdgeRoleScope } from '../../domain/role/edge-role.entity.js';
import { MembershipStatus } from '../../domain/membership/vertical-membership.entity.js';
import {
  AssignEdgeRoleUseCase,
  ResolveEffectivePermissionsUseCase,
} from './authorization.use-cases.js';

describe('AssignEdgeRoleUseCase', () => {
  it('rejects global role assignment by actor without global roles', async () => {
    const roles = {
      findRoleById: vi.fn().mockResolvedValue({
        id: 'role-global',
        code: 'EDGE_PLATFORM_SUPER_ADMIN',
        scope: EdgeRoleScope.GLOBAL,
        isActive: true,
        isSystem: true,
      }),
      listActiveAssignmentsForAdministrator: vi.fn().mockResolvedValue([]),
      createAssignment: vi.fn(),
    };
    const memberships = { findById: vi.fn() };
    const useCase = new AssignEdgeRoleUseCase(roles as never, memberships as never);

    await expect(
      useCase.execute({
        actorId: 'vertical-admin-1',
        administratorId: 'target-1',
        roleId: 'role-global',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      message: expect.stringContaining('cannot assign global'),
    });
    expect(roles.createAssignment).not.toHaveBeenCalled();
  });

  it('rejects attaching a global role to a vertical membership', async () => {
    const roles = {
      findRoleById: vi.fn().mockResolvedValue({
        id: 'role-global',
        scope: EdgeRoleScope.GLOBAL,
        isActive: true,
      }),
      listActiveAssignmentsForAdministrator: vi.fn(),
      createAssignment: vi.fn(),
    };
    const useCase = new AssignEdgeRoleUseCase(roles as never, { findById: vi.fn() } as never);

    await expect(
      useCase.execute({
        actorId: 'platform-admin-1',
        administratorId: 'target-1',
        roleId: 'role-global',
        membershipId: 'mem-1',
        scopeVerticalId: 'vert-1',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects vertical role when membership belongs to another vertical', async () => {
    const roles = {
      findRoleById: vi.fn().mockResolvedValue({
        id: 'role-v',
        scope: EdgeRoleScope.VERTICAL,
        isActive: true,
      }),
      createAssignment: vi.fn(),
    };
    const memberships = {
      findById: vi.fn().mockResolvedValue({
        id: 'mem-1',
        administratorId: 'target-1',
        verticalId: 'pharmacy',
        status: MembershipStatus.ACTIVE,
      }),
    };
    const useCase = new AssignEdgeRoleUseCase(roles as never, memberships as never);

    await expect(
      useCase.execute({
        actorId: 'actor-1',
        administratorId: 'target-1',
        roleId: 'role-v',
        membershipId: 'mem-1',
        scopeVerticalId: 'restaurant',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });
});

describe('ResolveEffectivePermissionsUseCase', () => {
  it('resolves GLOBAL-only when verticalId omitted (no cross-vertical merge)', async () => {
    const roles = {
      listActiveAssignmentsForAdministrator: vi.fn().mockResolvedValue([
        { roleId: 'global-role', scopeVerticalId: null },
      ]),
      findPermissionCodesByRoleIds: vi.fn().mockResolvedValue(['platform:overview:read']),
    };
    const useCase = new ResolveEffectivePermissionsUseCase(roles as never);

    const result = await useCase.execute({ administratorId: 'admin-1' });

    expect(roles.listActiveAssignmentsForAdministrator).toHaveBeenCalledWith('admin-1', null);
    expect(result.permissions).toEqual(['platform:overview:read']);
  });

  it('passes verticalId for workspace-scoped resolution', async () => {
    const roles = {
      listActiveAssignmentsForAdministrator: vi.fn().mockResolvedValue([
        { roleId: 'global-role', scopeVerticalId: null },
        { roleId: 'vert-role', scopeVerticalId: 'vert-a' },
      ]),
      findPermissionCodesByRoleIds: vi
        .fn()
        .mockResolvedValue(['platform:overview:read', 'workspace:read']),
    };
    const useCase = new ResolveEffectivePermissionsUseCase(roles as never);

    await useCase.execute({ administratorId: 'admin-1', verticalId: 'vert-a' });

    expect(roles.listActiveAssignmentsForAdministrator).toHaveBeenCalledWith('admin-1', 'vert-a');
    expect(roles.listActiveAssignmentsForAdministrator).toHaveBeenCalledTimes(1);
  });
});
