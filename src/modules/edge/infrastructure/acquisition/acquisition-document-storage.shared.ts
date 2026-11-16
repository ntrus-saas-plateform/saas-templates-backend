export const ACQUISITION_ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const ACQUISITION_MAX_BYTE_SIZE = 10 * 1024 * 1024; // 10MB

export function assertAcquisitionDocumentPutConstraints(input: {
  storageKey?: string;
  privateLocator?: string;
  contentType?: string;
  byteSize?: number;
}): void {
  if (!input.storageKey?.trim() || !input.privateLocator?.trim()) {
    throw new Error('storageKey and privateLocator required');
  }
  const locator = input.privateLocator.trim();
  if (locator.startsWith('http://') || locator.startsWith('https://')) {
    throw new Error('public HTTP(S) locators are not allowed for acquisition documents');
  }
  const contentType = (input.contentType || '').trim().toLowerCase();
  if (!ACQUISITION_ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(
      `contentType not allowed: ${input.contentType}. Allowed: pdf, png, jpeg, webp`,
    );
  }
  if (!Number.isFinite(input.byteSize) || (input.byteSize as number) <= 0) {
    throw new Error('byteSize must be a positive number');
  }
  if ((input.byteSize as number) > ACQUISITION_MAX_BYTE_SIZE) {
    throw new Error(
      `document exceeds max size of ${ACQUISITION_MAX_BYTE_SIZE} bytes (10MB)`,
    );
  }
}
