import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ProductControlPaginationQueryDto,
  QuarantineProductControlEndpointDto,
  ReceiveProductControlCallbackDto,
  RegisterProductControlEndpointDto,
} from './product-control.dto.js';

describe('product-control.dto validation', () => {
  it('rejects invalid UUID on RegisterProductControlEndpointDto', async () => {
    const dto = plainToInstance(RegisterProductControlEndpointDto, {
      productRegistryId: 'not-a-uuid',
      productId: '11111111-1111-4111-8111-111111111111',
      platformId: '11111111-1111-4111-8111-111111111112',
      code: 'pc-1',
      baseUrl: 'https://pc.example.com',
      contractVersion: '1.0.0',
      authProfile: 'OAUTH2_CC',
      credentialRef: 'cred-ref-1',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'productRegistryId')).toBe(true);
  });

  it('rejects http baseUrl (TLS required at DTO)', async () => {
    const dto = plainToInstance(RegisterProductControlEndpointDto, {
      productRegistryId: '11111111-1111-4111-8111-111111111111',
      productId: '11111111-1111-4111-8111-111111111112',
      platformId: '11111111-1111-4111-8111-111111111113',
      code: 'pc-1',
      baseUrl: 'http://pc.example.com',
      contractVersion: '1.0.0',
      authProfile: 'OAUTH2_CC',
      credentialRef: 'cred-ref-1',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'baseUrl')).toBe(true);
  });

  it('rejects unknown properties (forbidNonWhitelisted path)', async () => {
    const dto = plainToInstance(RegisterProductControlEndpointDto, {
      productRegistryId: '11111111-1111-4111-8111-111111111111',
      productId: '11111111-1111-4111-8111-111111111112',
      platformId: '11111111-1111-4111-8111-111111111113',
      code: 'pc-1',
      baseUrl: 'https://pc.example.com',
      contractVersion: '1.0.0',
      authProfile: 'OAUTH2_CC',
      credentialRef: 'cred-ref-1',
      clientSecret: 'leaked',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts valid RegisterProductControlEndpointDto', async () => {
    const dto = plainToInstance(RegisterProductControlEndpointDto, {
      productRegistryId: '11111111-1111-4111-8111-111111111111',
      productId: '11111111-1111-4111-8111-111111111112',
      platformId: '11111111-1111-4111-8111-111111111113',
      code: 'pc-pharma',
      baseUrl: 'https://pc.example.com/v1',
      contractVersion: '1.0.0',
      authProfile: 'HMAC_SIGNED',
      credentialRef: 'vault:pci/pharma',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('requires reason on QuarantineProductControlEndpointDto', async () => {
    const dto = plainToInstance(QuarantineProductControlEndpointDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('bounds pagination limit to max 100', async () => {
    const dto = plainToInstance(ProductControlPaginationQueryDto, { limit: 500 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('requires callbackId + idempotencyKey + payload on callback DTO', async () => {
    const dto = plainToInstance(ReceiveProductControlCallbackDto, {
      callbackId: 'cb-1',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'idempotencyKey')).toBe(true);
    expect(errors.some((e) => e.property === 'payload')).toBe(true);
  });
});
