/**
 * Lab opt-in runner for Edge P0 e2e (sets EDGE_P0_E2E + LIVE_COMPLETE_E2E).
 * Usage: node scripts/run-e2e-p0-lab.mjs
 * Requires EDGE_API_URL (and any LIVE_* vars) in the environment.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

process.env.EDGE_P0_E2E = "1";
process.env.LIVE_COMPLETE_E2E = "1";

const args = [
  "vitest",
  "run",
  "--config",
  "./vitest.config.e2e.ts",
  "test/e2e/edge-p0-console-routes.e2e-spec.ts",
  "test/e2e/live-complete-smoke.e2e-spec.ts",
  ...process.argv.slice(2),
];

const result = spawnSync("pnpm", ["exec", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
