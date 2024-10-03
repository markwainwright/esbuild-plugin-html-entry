# `esbuild-plugin-html-entry`

An [esbuild] plugin that allows HTML files to be used as entry points.

`<script>` and `<link>` tags with relative `src`/`href` attribute values will be added to the build
and the value will be replaced with the path of the built file.

This path will be absolute if the esbuild [`publicPath`] option is set, or relative if not.

There are a few similar plugins out there already, but this one has a few benefits at time of
writing:

- Optionally supports [Subresource Integrity] by adding `integrity` attribute to `<script>` and `<link>`
  tags
- Optionally allows the JS and CSS filenames to be customized independently of [`assetNames`] and
  [`chunkNames`]
- Automatically inserts `<link>` tags for CSS bundles immediately before the `<script>` tag they
  belong to
- Supports efficient code splitting:
  - When [`splitting`] is enabled, the plugin gathers JS files referenced by
    `<script type="module">` tags in all HTML entry points and passes them to a single esbuild run.
    This means code shared between multiple files can be extracted even if those files don't always
    appear together in each HTML entry point. It also results in the least amount of top-level JS
    files possible being created, which is good for caching
  - If you have any feedback on this behaviour, please feel free to open an issue
- Populates result [`metafile`] and [`outputFiles`] as similarly to JS/CSS entry points as possible
- Supports as many esbuild options as possible – e.g. [`external`] – and provides equivalent options
  to [`banner`] and [`footer`]
- Allows JS and CSS entry points alongside HTML entry points as normal
- Runs the fewest number of sub-builds possible:
  - One if you only use `<script type="module">` or `<script type="text/javascript">`, two if you
    mix both
- Supports ES module and CommonJS projects
- Comprehensive test coverage (snapshot style)

## Usage

```js
import * as esbuild from "esbuild";
import { esbuildPluginHtmlEntry } from "esbuild-plugin-html-entry";

esbuild.build({
  entryPoints: ["src/index.html", "src/other.html"],
  plugins: [esbuildPluginHtmlEntry({ integrity: "sha256" })],
});
```

## Plugin options

- **`integrity`** (optional) – the hash algorithm to use for [Subresource Integrity]
  - Browsers currently support `sha256`, `sha384`, and `sha512`
  - If omitted, Subresource Integrity will not be enabled
- **`subresourceNames`** (optional) – filename format for top-level JS and CSS files
  - Default: value of `assetNames`
  - See [esbuild docs](https://esbuild.github.io/api/#asset-names) for placeholder format
- **`minifyOptions`** (optional) – options passed to [html-minifier-terser] if `minify` is `true`
- **`banner`** (optional) – prepend a string to each output HTML file. See [`banner`]
- **`footer`** (optional) – append a string to each output HTML file. See [`footer`]

## esbuild options

This plugin is designed to work with as many combinations of esbuild options as possible. However
there are a couple of requirements to be aware of:

1. [`outdir`] must be set. The plugin validates this.
1. Since the plugin generates JS & CSS files in a separate build, to use [`serve`] mode, you need to
   configure esbuild to write to disk and serve from there, i.e.:
   1. [`write`](https://esbuild.github.io/api/#write) cannot be set to `false`
   1. `servedir` must be set equal to [`outdir`]

## Known issues/limitations

1. Does not support an equivalent of esbuild [`outExtension`] option for HTML files.
   - Output HTML files will always have the same extension as input HTML files (`.html` or `.htm`)
   - PRs welcome!
1. esbuild [`lineLimit`] option is only applied when [`minify`] is `true`
1. In `metafile`, `inputs[].imports[].kind` for HTML → JS/CSS imports will always be set to
   `"import-statement"`
   - Something like `"script-tag" | "link-tag"` would be possible, but I'm not sure how safe
     introducing new values would be
1. Inline `<script>` and `<style>` tags are not currently supported
1. Images and other types of subresources are not currently supported
1. It _should_ play nicely with other plugins but this hasn't been tested yet

[esbuild]: https://esbuild.github.io
[Subresource Integrity]: https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
[`splitting`]: https://esbuild.github.io/api/#splitting
[`banner`]: https://esbuild.github.io/api/#banner
[`external`]: https://esbuild.github.io/api/#external
[`assetNames`]: https://esbuild.github.io/api/#asset-names
[`chunkNames`]: https://esbuild.github.io/api/#chunk-names
[`external`]: https://esbuild.github.io/api/#external
[`footer`]: https://esbuild.github.io/api/#footer
[`lineLimit`]: https://esbuild.github.io/api/#line-limit
[`metafile`]: https://esbuild.github.io/api/#metafile
[`minify`]: https://esbuild.github.io/api/#minify
[`outdir`]: https://esbuild.github.io/api/#outdir
[`outExtension`]: https://esbuild.github.io/api/#out-extension
[`outputFiles`]: https://esbuild.github.io/api/#write
[`publicPath`]: https://esbuild.github.io/api/#public-path
[`serve`]: https://esbuild.github.io/api/#serve
[@chialab/esbuild-plugin-html]:
  https://github.com/chialab/rna/tree/main/packages/esbuild-plugin-html
[html-minifier-terser]: https://www.npmjs.com/package/html-minifier-terser#options-quick-reference
[prettier]: https://www.npmjs.com/package/prettier
