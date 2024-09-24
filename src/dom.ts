import { isAbsolute } from "node:path";

import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

interface AnnotatedElement {
  element: AnyNode;
  attribute: string;
}

function filterHref($: CheerioAPI, hrefAttr: string) {
  return function (_index: number, element: AnyNode) {
    const href = $(element).attr(hrefAttr);
    return (
      href !== undefined && !href.startsWith("data:") && !isAbsolute(href) && !href.includes("://")
    );
  };
}

export function findElements(html: string): [CheerioAPI, AnnotatedElement[]] {
  const $ = load(html);

  return [
    $,
    [
      ...$(
        'script[src]:not([type]), script[src][type="application/javascript"], script[src][type=""]'
      )
        .filter(filterHref($, "src"))
        .map((_, element) => ({ element, attribute: "src" })),

      ...$("link[href][rel=stylesheet]")
        .filter(filterHref($, "href"))
        .map((_, element) => ({ element, attribute: "href" })),
    ],
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
