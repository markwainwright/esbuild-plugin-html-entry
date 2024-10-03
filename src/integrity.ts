import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { OutputFile } from "esbuild";

function generateHashFromBuffer(algorithm: string, data: NodeJS.ArrayBufferView) {
  const hash = createHash(algorithm);
  hash.update(data);
  return hash.digest("base64");
}

async function generateHashFromFile(algorithm: string, path: string) {
  return generateHashFromBuffer(algorithm, await readFile(path));
}

export async function getIntegrity(
  algorithm: string | undefined,
  outputPathAbs: string,
  outputFiles?: OutputFile[]
): Promise<string | null> {
  if (!algorithm) {
    return null;
  }

  let hash;
  if (outputFiles) {
    const outputFile = outputFiles.find(file => file.path === outputPathAbs);
    if (!outputFile) {
      throw new Error(`failed to find "${outputPathAbs}" in outputFiles`);
    }
    hash = generateHashFromBuffer(algorithm, outputFile.contents);
  } else {
    hash = await generateHashFromFile(algorithm, outputPathAbs);
  }

  return `${algorithm}-${hash}`;
}
