import * as htmlMinifierTerser from "html-minifier-terser";
import * as prettier from "prettier";

export type MinifyOptions = htmlMinifierTerser.Options;
export type PrettifyOptions = prettier.Options;

export async function minify(html: string, options: MinifyOptions = {}): Promise<string> {
  return await htmlMinifierTerser.minify(html, options);
}

export async function prettify(html: string, options: PrettifyOptions = {}): Promise<string> {
  return prettier.format(html, {
    htmlWhitespaceSensitivity: "css",
    printWidth: 100,
    ...options,
    parser: "html",
  });
}
