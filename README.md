# @lumine-code/season

Reads, writes, and parses CSON and JSON files for Lumine packages.

## Features

- **Unified file API**: reads and writes CSON or JSON according to the file extension.
- **CSON parsing**: parses and stringifies CSON values through a compact CommonJS API.
- **Source validation**: reports syntax errors with the originating path and location details.
- **Optional caching**: caches parsed CSON values and exposes cache hit and miss counters.
- **Duplicate detection**: optionally rejects duplicate CSON object keys.

## Installation

```sh
npm install @lumine-code/season
```

## Usage

```js
const CSON = require('@lumine-code/season')

const settings = CSON.readFileSync('settings.cson')
CSON.writeFileSync('settings.json', settings)
```

Use `setCacheDir(directory)` to enable parsed CSON caching. The package creates missing parent directories when writing files or cache entries.

## Building

```sh
npm install
npm test
```

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
