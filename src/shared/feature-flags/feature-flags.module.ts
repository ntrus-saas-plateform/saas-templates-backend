import { Global, Module } from '@nestjs/common';
import { FEATURE_FLAG_SERVICE_PORT } from '../../modules/identity/domain/feature-flag/feature-flag.port.js';
import { TenantFeatureFlagService } from './tenant-feature-flag.service.js';

@Global()
@Module({
  providers: [
    TenantFeatureFlagService,
    { provide: FEATURE_FLAG_SERVICE_PORT, useExisting: TenantFeatureFlagService },
  ],
  exports: [FEATURE_FLAG_SERVICE_PORT, TenantFeatureFlagService],
})
export class FeatureFlagsModule {}
