import { isAbsolute } from "node:path";

import { load, type CheerioAPI } from "cheerio";

type Element = ReturnType<CheerioAPI>[0]; // actually AnyNode

interface AnnotatedElement {
  readonly element: Element;
  readonly hrefAttribute: string;
  /** Which esbuild `format` the subresource should be built with */
  readonly format: "iife" | "esm" | "any";
}

const SELECTOR =
  'script[src]:not([type]), script[src][type="application/javascript"], script[src][type=""], script[src][type=module], link[href][rel=stylesheet]';

export function findElements(
  html: string,
  charset: "ascii" | "utf8" = "ascii"
): [CheerioAPI, AnnotatedElement[]] {
  const $ = load(html, { xml: { decodeEntities: charset === "ascii", xmlMode: false } });

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
            hrefAttribute: "src",
            format: $element.attr("type") === "module" ? "esm" : "iife",
          } as const;
        }

        return { element, hrefAttribute: "href", format: "any" } as const;
      })
      .filter(element => element !== null),
  ];
}

export function getHref($: CheerioAPI, element: AnnotatedElement): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return $(element.element).attr(element.hrefAttribute)!;
}

export function setAttributes(
  $: CheerioAPI,
  element: AnnotatedElement,
  href: string,
  integrity: string | null
): void {
  const $element = $(element.element);
  $element.attr(element.hrefAttribute, href);

  if (integrity) {
    $element.attr("integrity", integrity);
  }
}

export function insertLinkElement($: CheerioAPI, scriptElement: Element): AnnotatedElement {
  const $scriptElementSiblings = $(scriptElement).parent().contents();
  const nodeBeforeScriptElement = $scriptElementSiblings.get(
    $scriptElementSiblings.index(scriptElement) - 1
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const linkElement = $("<link>")
    .attr({ href: "", rel: "stylesheet" })
    .insertBefore(scriptElement)
    .get(0)!;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  if (nodeBeforeScriptElement?.type === "text") {
    // Copy any whitespace before the script element on the same line
    const newNode = nodeBeforeScriptElement.cloneNode();
    newNode.data = newNode.data
      .split(/(\n)/)
      .slice(-2)
      .join("")
      .replace(/[^\s+]+/g, "");
    $(newNode).insertBefore(scriptElement);
  }

  return {
    element: linkElement,
    hrefAttribute: "href",
    format: "iife",
  };
}

export function getHtml($: CheerioAPI): string {
  return $.html();
}
