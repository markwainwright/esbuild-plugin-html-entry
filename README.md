# `esbuild-plugin-html-entry`

An esbuild plugin allowing HTML files to be used as entry points.

Scripts and stylesheets with relative paths will be added to the build and the `src`/`href`
attribute will be replaced with the built file – either as a relative or absolute path depending on
your esbuild [`publicPath`] option.

There are a few similar plugins already out there, but this one has a few benefits at time of
writing:

- Supports the `integrity` attribute
- Correctly populates the result [`metafile`] and [`outputFiles`] as you would expect with vanilla
  esbuild
- Optionally allows the filename of scripts and stylesheets to be customized independently of
  `assetNames` and `chunkNames`
- Automatically inserts `<link>` tags for CSS bundles immediately before the `<script>` tag they
  belong to
- Uses esbuild's built-in path resolution, meaning:
  - It respects options like [`external`]
  - Other plugins can influence path resolution behaviour
- Allows JS and CSS entry points alongside HTML ones
- Uses esbuild's built-in path resolution, meaning:
  - It respects options like [`external`]
  - Other plugins can influence path resolution behaviour
- Ensures that a script or stylesheet referenced by multiple HTML entry points is only built once
- Does not have a large abstraction layer between the plugin and esbuild (c.f.
  [@chialab/esbuild-plugin-html]) – this should hopefully make it easier to fix bugs and maintain
- Should work with a broad set of esbuild options, with only a couple of restrictions (see below)

## Usage

```js
import * as esbuild from "esbuild";
import esbuildPluginHtmlEntry from "esbuild-plugin-html-entry";

esbuild.build({
  entryPoints: ["src/index.html"],
  plugins: [
    esbuildPluginHtmlEntry({
      subresourceNames: "[ext]/[name]-[hash]",
      integrity: "sha256",
      minifyOptions: {
        collapseWhitespace: true,
      },
    }),
  ],
});
```

## Options

- `subresourceNames` (optional) – filename format for top-level script and stylesheets. See
  [esbuild docs](https://esbuild.github.io/api/#asset-names). Defaults to value of `assetNames`
- `integrity` (optional)
- `minifyOptions` (optional) – options passed to [html-minifier-terser] if `minify` is `true`

## esbuild config restrictions

- To use [`serve`]:
  1. [`write`](https://esbuild.github.io/api/#write) cannot be set to `false`
  1. `servedir` must be set equal to [`outdir`]
- To use [`publicPath`] (absolute URLs):
  1. [`outdir`] must be set

[`publicPath`]: https://esbuild.github.io/api/#public-path
[`serve`]: https://esbuild.github.io/api/#serve
[`outdir`]: https://esbuild.github.io/api/#outdir
[`metafile`]: https://esbuild.github.io/api/#metafile
[`external`]: https://esbuild.github.io/api/#external
[`outputFiles`]: https://esbuild.github.io/api/#write
[`external`]: https://esbuild.github.io/api/#external
[@chialab/esbuild-plugin-html]:
  https://github.com/chialab/rna/tree/main/packages/esbuild-plugin-html
[html-minifier-terser]: https://www.npmjs.com/package/html-minifier-terser
[prettier]: https://www.npmjs.com/package/prettier
