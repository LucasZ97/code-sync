# CodeSync

A cross-platform desktop tool that syncs code between machines via Git patches over SSH — no shared Git remote required.

## The Problem

You work on multiple machines (e.g., a MacBook and a Linux workstation) but can't always push to a shared Git remote — maybe the repo is air-gapped, the CI pipeline is slow, or you simply want to move uncommitted work between machines quickly.

## How It Works

```
┌──────────────┐         SSH/SFTP         ┌──────────────┐
│  Machine A   │ ──── push patch ────────▶ │ Linux Relay  │
│  (macOS/Win) │                           │   Server     │
└──────────────┘                           └──────┬───────┘
                                                  │
┌──────────────┐         SSH/SFTP                 │
│  Machine B   │ ◀─── pull patch ─────────────────┘
│  (macOS/Win) │
└──────────────┘
```

1. **Push** — Select changed files, generate a unified diff patch, upload to a relay server via SFTP
2. **Pull** — Browse patches on the server, download and apply to your local repo with multi-strategy fallback

Patches carry metadata (base commit, SHA256 checksum, timestamp) for integrity and traceability.

## Features

- **Multi-project / multi-server** — manage multiple repos and SSH connections
- **Smart patch generation** — encoding normalization (GBK/UTF-16 → UTF-8), filemode noise filtering, Windows path validation
- **Reliable transfer** — atomic writes (`.tmp` + rename), SHA256 integrity checks, content deduplication
- **5-level apply fallback** — `git apply` → `--ignore-whitespace` → `--3way` → `patch -p1` → `--reject`
- **Diff visualization** — unified and side-by-side views powered by diff2html
- **Sync history** — SQLite-backed log of all push/pull operations
- **Syncignore** — gitignore-style rules to exclude files from patches
- **i18n** — English and Chinese UI
- **TOFU host key verification** — first-connect trust with fingerprint persistence

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite |
| Backend | Rust, Tauri 2, Tokio |
| SSH | russh, russh-sftp |
| Storage | TOML config, SQLite history |
| CI | GitHub Actions (Windows build) |

## Project Structure

```
code-sync-app/
├── src/                    # React frontend
│   ├── components/         # UI components (panels, modals, layout)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # i18n, IPC bridge
│   ├── store/              # State management
│   └── types/              # TypeScript type definitions
└── src-tauri/
    └── src/
        ├── commands/       # Tauri command handlers (IPC boundary)
        └── domain/         # Core business logic
            ├── git/        # Status, patch generation, apply
            ├── ssh/        # Client, SFTP, retry with backoff
            ├── patch/      # Upload, download, listing
            ├── encoding/   # Charset detection & normalization
            ├── config/     # TOML config persistence
            ├── history/    # SQLite history store
            └── syncignore/ # Glob-based file filtering
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable toolchain
- Platform build dependencies per [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
cd code-sync-app
npm install
npm run tauri dev
```

### Build

```bash
cd code-sync-app
npm run tauri build
```

Produces platform-specific installers in `src-tauri/target/release/bundle/`.

## Configuration

All data lives under `~/.config/codesync/`:

| File | Purpose |
|------|---------|
| `config.toml` | Projects, SSH connections, preferences |
| `known_hosts.json` | TOFU host key fingerprints |
| `patches/` | Local patch file cache |
| `history.db` | Sync operation history |

## License

MIT
