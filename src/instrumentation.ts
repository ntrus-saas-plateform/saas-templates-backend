import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const serviceName = process.env.SERVICE_NAME ?? 'platform-core';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const enabled = process.env.OTEL_ENABLED !== 'false';

if (enabled) {
  const traceExporter = otlpEndpoint
    ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
    : undefined;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Node-only: Nest loads this via `--import`; guard so Edge/Next never call process.on.
  if (typeof process.on === "function") {
    process.on("SIGTERM", () => {
      void sdk.shutdown();
    });
  }
}
