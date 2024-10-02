import { cwd } from "node:process";

import type { BuildOptions } from "esbuild";

export function getWorkingDirAbs(buildOptions: BuildOptions): string {
  return buildOptions.absWorkingDir ?? cwd();
}
