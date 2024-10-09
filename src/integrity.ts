import { createHash } from "node:crypto";

import type { OutputFile } from "esbuild";

function generateHash(algorithm: string, data: NodeJS.ArrayBufferView) {
  const hash = createHash(algorithm);
  hash.update(data);
  return hash.digest("base64");
}

export function getIntegrity(
  algorithm: string | undefined,
  outputPathAbs: string,
  outputFiles: OutputFile[]
): string | null {
  if (!algorithm) {
    return null;
  }

  const outputFile = outputFiles.find(file => file.path === outputPathAbs);
  if (!outputFile) {
    throw new Error(`outputFile with path="${outputPathAbs}" is missing`);
  }

  return `${algorithm}-${generateHash(algorithm, outputFile.contents)}`;
}
