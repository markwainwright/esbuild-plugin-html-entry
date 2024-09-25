import * as htmlMinifierTerser from "html-minifier-terser";

export type MinifyOptions = htmlMinifierTerser.Options;

export async function minify(html: string, options: MinifyOptions = {}): Promise<string> {
  return await htmlMinifierTerser.minify(html, options);
}
