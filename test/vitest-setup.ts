import { vi } from 'vitest';

process.env.TOKEN_DENYLIST_ENABLED = 'false';
process.env.KEYCLOAK_TOKEN_INTROSPECTION_ENABLED = 'false';

const noopDecorator = () => () => {};

vi.mock('@nestjs/swagger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/swagger')>();
  return {
    ...actual,
    ApiTags: noopDecorator,
    ApiOperation: noopDecorator,
    ApiResponse: noopDecorator,
    ApiBearerAuth: noopDecorator,
    ApiSecurity: noopDecorator,
    ApiParam: noopDecorator,
    ApiQuery: noopDecorator,
    ApiBody: noopDecorator,
    ApiConsumes: noopDecorator,
    ApiProduces: noopDecorator,
    ApiHeader: noopDecorator,
    ApiExtraModels: noopDecorator,
    ApiProperty: noopDecorator,
    ApiPropertyOptional: noopDecorator,
    ApiOkResponse: noopDecorator,
    ApiCreatedResponse: noopDecorator,
    ApiForbiddenResponse: noopDecorator,
    ApiUnauthorizedResponse: noopDecorator,
    ApiNotFoundResponse: noopDecorator,
    ApiBadRequestResponse: noopDecorator,
    ApiConflictResponse: noopDecorator,
  };
});
