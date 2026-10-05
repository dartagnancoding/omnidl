# omnidl

Media download CLI. Paste a URL from YouTube, Twitter/X, TikTok, Instagram, Pinterest (and ~1800 other sites) and it detects the source, picks the right tool and saves the file to a configured directory.

> **What this is (and isn't).** This project is an **orchestration layer**, not a scraper. The heavy lifting is done by two mature tools — [yt-dlp](https://github.com/yt-dlp/yt-dlp) (video) and [gallery-dl](https://github.com/mikf/gallery-dl) (image galleries/boards). omnidl adds domain routing, destination config, terminal UX, progress parsing and a batch queue. Personal use only — no DRM/paywall bypass, no mass scraping, no redistribution.

*Leia em português: [README.pt-BR.md](README.pt-BR.md)*

## Prerequisites

- Node.js >= 20
- External binaries on PATH (run `omnidl doctor` to check):
  - `yt-dlp` — `winget install yt-dlp.yt-dlp`
  - `ffmpeg` — `winget install Gyan.FFmpeg` (required for mp3 conversion)
  - `gallery-dl` — `winget install mikf.gallery-dl`

## Install

omnidl is not published to npm. Install it from source:

```sh
git clone https://github.com/dartagnancoding/omnidl.git
cd omnidl
npm install     # also builds dist/ (prepare script)
npm link        # makes `omnidl` available globally
omnidl doctor   # verify external binaries
```

`npm link` points the global `omnidl` command at **this folder**. If you move
or rename the folder, run `npm link` again from the new location.

To update: `git pull && npm install && npm run build`.

To uninstall: `npm unlink -g omnidl`.

## Usage

### Interactive menu

Run `omnidl` with no arguments to get a menu: download media, change the
default destination folders (video/audio/image) or run the health check —
no flags to remember. The download flow asks mp4 vs mp3, quality, and shows
the configured default folder (editable per download).

```sh
omnidl
```

### Direct / scriptable

```sh
# Video (default: best quality, saved to the configured videoDir)
omnidl "https://www.youtube.com/watch?v=..."

# Audio only, converted to mp3
omnidl "https://www.youtube.com/watch?v=..." --audio-only

# Cap the resolution
omnidl "https://x.com/user/status/..." -q 720

# Pinterest pin or whole board (goes through gallery-dl)
omnidl "https://br.pinterest.com/user/my-board/"

# Instagram and X/Twitter now require an authenticated session for most
# video extraction, even on public posts. Reuse your browser's cookies:
omnidl "https://x.com/user/status/..." --cookies-from-browser chrome
# Zen Browser (a Firefox fork) is auto-detected — no manual profile path needed:
omnidl "https://www.instagram.com/reel/..." --cookies-from-browser zen

# Set it once as the default so you don't need the flag every time:
omnidl config set cookiesFromBrowser zen

# Batch: one URL per line, '#' for comments; limited concurrency
omnidl -b urls.txt -c 3

# Interactive mode: just run it with no arguments
omnidl
```

### Commands

| Command | Description |
|---|---|
| `omnidl [url]` | Download (default command; opens the menu if the URL is omitted) |
| `omnidl config list\|get\|set\|path` | Manage persisted settings |
| `omnidl doctor` | Check that yt-dlp, ffmpeg and gallery-dl are installed |
| `omnidl claude [dir]` | Open Claude Code in a folder (default: current folder) |

### Options

| Flag | Description |
|---|---|
| `-o, --output <dir>` | Destination directory (overrides config) |
| `-a, --audio-only` | Extract audio and convert to mp3 |
| `-q, --quality <q>` | Max video height: `best`, `1080`, `720`, `480`, `360` |
| `-f, --format <fmt>` | Raw yt-dlp format expression (overrides `--quality`) |
| `-b, --batch <file>` | Text file with one URL per line |
| `-c, --concurrency <n>` | Parallel downloads in batch mode |
| `--cookies-from-browser <browser>` | Read session cookies from `chrome`, `firefox`, `edge`, `zen`, ... |

### Configuration

Persisted at `~/.config/omnidl/config.json`:

```sh
omnidl config list
omnidl config set videoDir "D:\Media\Videos"
omnidl config set concurrency 3
omnidl config path
```

| Key | Default | Meaning |
|---|---|---|
| `videoDir` | `~/Downloads/omnidl/video` | Destination for video |
| `audioDir` | `~/Downloads/omnidl/audio` | Destination for mp3 |
| `imageDir` | `~/Downloads/omnidl/images` | Destination for galleries/pins |
| `concurrency` | `2` | Batch parallelism (1–8) |
| `cookiesFromBrowser` | *(none)* | Default browser for session cookies (`chrome`, `firefox`, `edge`, `zen`, ...) |

## Architecture

```
URL -> validation -> router -> adapter -> subprocess -> progress stream -> saved files
```

- `src/core/router.ts` — maps a URL to an adapter by domain; unknown domains fall back to yt-dlp (it supports far more sites than we enumerate).
- `src/adapters/` — `Adapter` interface + wrappers over yt-dlp and gallery-dl. Custom adapters (Fase 4) plug in ahead of the generic ones.
- `src/services/` — binary detection with install hints, yt-dlp stdout progress parsing, filesystem helpers and the concurrency pool.
- `src/core/result.ts` — `Result<T, E>` for expected failures; exceptions stay exceptional.

## Development

```sh
npm run dev     # tsc --watch
npm test        # vitest unit tests (router, progress parser, fs helpers)
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Error: Cannot find module ...\node_modules\omnidl\dist\cli\index.js` | The global link points to a folder that moved or was deleted. Run `npm link` again from the project folder. |
| `omnidl` not recognized | `npm link` was never run, or the npm global folder (`npm config get prefix`) is not on PATH. |
| Instagram / X downloads fail | They need a logged-in session: use `--cookies-from-browser <browser>`. |
| `Requested format is not available` | Update yt-dlp (`yt-dlp -U` or `winget upgrade yt-dlp.yt-dlp`). Sites change often. |

## Legal

Personal-use tool. You are responsible for respecting each site's terms of
service and the copyright of what you download. omnidl does not bypass DRM or
paywalls.

## License

[MIT](LICENSE)

## Roadmap

Implemented: Fases 1–3 of the briefing (foundation, UX, coverage). Pending (Fase 4): custom adapter for an uncovered site using the XHR-endpoint technique, plus rate limiting and retry with backoff. See [media-downloader-cli-briefing.md](media-downloader-cli-briefing.md).
