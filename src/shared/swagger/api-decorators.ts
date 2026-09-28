import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';
import {
  ApiDataWrapperDto,
  ApiErrorResponseDto,
  PaginationMetaDto,
} from './api-response.dto.js';

function resolveDataSchema(model?: Type): SchemaObject | ReferenceObject {
  if (model) {
    return { $ref: getSchemaPath(model) };
  }
  return { type: 'object', additionalProperties: true };
}

function dataEnvelopeSchema(
  dataSchema: SchemaObject | ReferenceObject,
  paginated = false,
): SchemaObject {
  if (paginated) {
    return {
      type: 'object',
      required: ['data', 'pagination'],
      properties: {
        data: { type: 'array', items: dataSchema },
        pagination: { $ref: getSchemaPath(PaginationMetaDto) },
      },
    };
  }
  return {
    type: 'object',
    required: ['data'],
    properties: { data: dataSchema },
  };
}

/** Standard 401/403 error envelope on protected routes. */
export function ApiStandardErrors(): ReturnType<typeof applyDecorators> {
  return applyDecorators(
    ApiResponse({ status: 401, type: ApiErrorResponseDto }),
    ApiResponse({ status: 403, type: ApiErrorResponseDto }),
  );
}

/** `{ data: T }` success response (optionally typed). */
export function ApiOkDataResponse(
  model?: Type,
  paginated = false,
): ReturnType<typeof applyDecorators> {
  const decorators: Array<ReturnType<typeof applyDecorators>> = [
    ApiExtraModels(ApiDataWrapperDto, PaginationMetaDto),
    ApiStandardErrors(),
  ];
  if (model) {
    decorators.push(ApiExtraModels(model));
  }
  const dataSchema = resolveDataSchema(model);
  decorators.push(
    ApiResponse({
      status: 200,
      schema: dataEnvelopeSchema(dataSchema, paginated),
    }),
  );
  return applyDecorators(...decorators);
}

/** `{ data: T }` created response (optionally typed). */
export function ApiCreatedDataResponse(model?: Type): ReturnType<typeof applyDecorators> {
  const decorators: Array<ReturnType<typeof applyDecorators>> = [
    ApiExtraModels(ApiDataWrapperDto),
    ApiStandardErrors(),
  ];
  if (model) {
    decorators.push(ApiExtraModels(model));
  }
  decorators.push(
    ApiResponse({
      status: 201,
      schema: dataEnvelopeSchema(resolveDataSchema(model)),
    }),
  );
  return applyDecorators(...decorators);
}

/** Explicit request body schema (use on POST/PATCH with DTO classes). */
export function ApiJsonBody(model: Type): ReturnType<typeof applyDecorators> {
  return applyDecorators(ApiBody({ type: model }));
}
