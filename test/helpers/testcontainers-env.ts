import { execSync } from 'node:child_process';

export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const runTestcontainers =
  process.env.TESTCONTAINERS === 'true' && isDockerAvailable();
