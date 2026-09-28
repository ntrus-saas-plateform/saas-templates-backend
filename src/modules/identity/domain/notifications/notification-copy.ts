import type { IntegrationEvent } from '../../../../core/domain/events/integration-event.js';

export type InboxNotificationDraft = {
  userId: string;
  organizationId?: string | null;
  category: string;
  title: string;
  body: string;
  href?: string | null;
  priority?: string;
};

/** Map identity integration events → in-app inbox drafts. */
export function draftFromIntegrationEvent(
  event: IntegrationEvent,
): InboxNotificationDraft | null {
  const payload = event.payload as Record<string, unknown>;
  const organizationId =
    (typeof payload.organizationId === 'string' ? payload.organizationId : null) ??
    event.organizationId;

  switch (event.eventType) {
    case 'membership.created.v1': {
      const userId = asString(payload.userId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'membership',
        title: 'Organization access granted',
        body: 'You were added to an organization.',
        href: '/settings/memberships',
      };
    }
    case 'membership.revoked.v1': {
      const userId = asString(payload.userId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'membership',
        title: 'Organization access revoked',
        body: 'Your membership in an organization was revoked.',
        href: '/settings/memberships',
      };
    }
    case 'membership.roles.updated.v1': {
      const userId = asString(payload.userId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'membership',
        title: 'Roles updated',
        body: 'Your organization roles or permissions changed.',
        href: '/settings/memberships',
      };
    }
    case 'user.activated.v1': {
      const userId = asString(payload.identityId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'account',
        title: 'Account activated',
        body: 'Your invitation was accepted and your account is active.',
        href: '/settings/profile',
      };
    }
    case 'user.suspended.v1': {
      const userId = asString(payload.identityId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'security',
        title: 'Account suspended',
        body: 'Your account was suspended by an administrator.',
        href: '/settings/security',
        priority: 'high',
      };
    }
    case 'user.disabled.v1': {
      const userId = asString(payload.identityId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'security',
        title: 'Account disabled',
        body: 'Your account was disabled by an administrator.',
        href: '/settings/security',
        priority: 'high',
      };
    }
    case 'user.reactivated.v1': {
      const userId = asString(payload.identityId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'account',
        title: 'Account reactivated',
        body: 'Your account was reactivated.',
        href: '/settings/profile',
      };
    }
    case 'platform.organization.switched.v1': {
      const userId = asString(payload.userId);
      if (!userId) return null;
      return {
        userId,
        organizationId,
        category: 'organization',
        title: 'Active organization changed',
        body: 'Your active organization context was switched.',
        href: '/settings/memberships',
      };
    }
    case 'security.policy.updated.v1': {
      const userId = asString(payload.actorId) ?? event.actor?.id;
      if (!userId || event.actor?.type !== 'user') return null;
      return {
        userId,
        organizationId: event.organizationId,
        category: 'security',
        title: 'Security policies updated',
        body: 'Tenant security policies were changed.',
        href: '/settings/security',
      };
    }
    default:
      return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
