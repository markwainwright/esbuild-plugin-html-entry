#!/bin/sh
set -e

rm -rf dist

tsc --project tsconfig.build.json
tsc --project tsconfig.build.cjs.json

echo '{ "type": "module" }' > dist/esm/package.json
echo '{ "type": "commonjs" }' > dist/cjs/package.json
