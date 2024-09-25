import { isAbsolute } from "node:path";

import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { Format } from "esbuild";

interface AnnotatedElement {
  element: AnyNode;
  attribute: string;
  format: Format;
}

const SELECTOR =
  'script[src]:not([type]), script[src][type="application/javascript"], script[src][type=""], script[src][type=module], link[href][rel=stylesheet]';

export function findElements(html: string): [CheerioAPI, AnnotatedElement[]] {
  const $ = load(html);

  return [
    $,
    $(SELECTOR)
      .get()
      .map(element => {
        const $element = $(element);
        const isScript = element.tagName === "script";
        const href = $element.attr(isScript ? "src" : "href");

        if (
          href === undefined ||
          href.startsWith("data:") ||
          isAbsolute(href) ||
          href.includes("://")
        ) {
          return null;
        }

        if (isScript) {
          return {
            element,
            attribute: "src",
            format: $element.attr("type") === "module" ? ("esm" as const) : ("iife" as const),
          };
        }

        return { element, attribute: "href", format: "iife" as const };
      })
      .filter(element => element !== null),
  ];
}

export function setAttributes(
  $: CheerioAPI,
  element: AnnotatedElement,
  publicPath: string,
  integrity: string | null
): void {
  const $element = $(element.element);
  $element.attr(element.attribute, publicPath);

  if (integrity) {
    $element.attr("integrity", integrity);
  }
}
