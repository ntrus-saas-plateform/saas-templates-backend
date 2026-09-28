import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, REQUIRE_CAPABILITY_KEY } from './decorators.js';

/**
 * Industry capability checks are removed with the business-profile catalog.
 * Routes without @RequiresCapability stay open to the other guards.
 * A leftover @RequiresCapability is ignored so tenant, user, and organization
 * routes are not blocked by a deleted profile engine.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    this.reflector.getAllAndOverride<string>(REQUIRE_CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return true;
  }
}
