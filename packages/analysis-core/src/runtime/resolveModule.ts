import { createRequire } from 'node:module';
import path from 'node:path';

// Capture the application's runtime root. import.meta.url in bundled code can
// become a build-machine path; process.cwd() stays valid in the deployed app.
const applicationManifest = path.join(process.cwd(), 'package.json');

export function resolveModule(specifier: string, from = applicationManifest): string {
  // Keep Node resolution dynamic so bundlers cannot substitute module IDs.
  const resolve = Reflect.get(createRequire(from), 'resolve') as (id: string) => string;
  return resolve(specifier);
}
