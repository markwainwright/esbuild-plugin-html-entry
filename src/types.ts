import { type Metafile, type OutputFile } from "esbuild";

export interface HtmlResult {
  /** Map of resolved entry point path to original import href */
  imports: Map<string, string>;
  watchFiles: Set<string>;
}

export interface AssetResult {
  mainOutputPathRel: string;
  cssOutputPathRel?: string;
  watchFiles: string[];
  outputFiles?: OutputFile[];
  inputs: Metafile["inputs"];
  outputs: Metafile["outputs"];
}

export interface Results {
  htmls: Map<string, HtmlResult>;
  assets: Map<string, Promise<AssetResult>>;
}
