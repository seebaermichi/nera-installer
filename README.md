# 🛠️ Nera Installer

[![Test](https://github.com/seebaermichi/nera-installer/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-installer/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/installer)](https://www.npmjs.com/package/@nera-static/installer)

> ## ⚠️ Deprecated — use [`@nera-static/nera`](https://github.com/seebaermichi/nera-cli)
>
> This package is superseded by **`@nera-static/nera`**, the one Nera CLI. Nera
> sites are no longer git clones of the generator that carry the engine under
> `src/`; a scaffolded site now depends on the published `@nera-static/core`
> engine, and a single `nera` command scaffolds, builds, previews, updates and
> validates it (see [ROADMAP-core.md](https://github.com/seebaermichi/nera/blob/main/ROADMAP-core.md)).
>
> | Old (`@nera-static/installer`) | New (`@nera-static/nera`) |
> |---|---|
> | `npx @nera-static/installer new my-site` | `npx @nera-static/nera new my-site` |
> | `nera update` (re-clone + restore) | `nera update` (`npm update`; `--migrate` converts a clone) |
> | — | `nera build` / `nera dev` / `nera serve` / `nera validate` |
>
> **Migrating an existing cloned site:** install the new CLI and run
> `nera update --migrate` inside the site — it adds the `@nera-static/nera`
> dependency, rewrites the scripts, removes the vendored `src/` engine, and
> installs, leaving your `pages/`, `config/` and `theme/` untouched.
>
> The documentation below describes the deprecated clone-based behaviour and is
> kept for existing users.

A simple CLI tool to create new [Nera](https://github.com/seebaermichi/nera) static site projects.

## 📦 Installation

```bash
npm install -g @nera-static/installer
```

## 🚀 Usage

### Create new project
```bash
nera new <project-name>
```

This will:

1. Clone the official Nera starter template
2. Remove the `.git` folder
3. Make the scaffold your own project: set `name` to `<project-name>`, reset
   `version` to `1.0.0`, drop the generator's `repository`/`bugs`/`homepage`,
   and record the generator version it cloned under `nera.version`
4. Run `npm install`
5. Print next steps

Project names may contain letters, digits, dots, dashes and underscores, and
must start with a letter or digit.

### Example

```bash
nera new my-website
cd my-website
npm run dev
```

### Update existing project
```bash
nera update
```

**⚠️ Important:** Always commit your changes before running `nera update` to ensure you can revert if needed.

This will:

1. Check that you're in a Nera project
2. Create a backup of `assets/`, `config/app.yaml` and `pages/` in `.nera-backup`
3. Clone the latest main branch from https://github.com/seebaermichi/nera.git
4. Update `src/` and merge `package.json`
5. Restore backup files
6. Install updated dependencies
7. Remove the backup, but only once every step above has succeeded

Your `views/` are **not** touched. A Nera site is a clone of the generator, so
`views/layouts/layout.pug` is your own site layout rather than a vendor file —
overwriting it would silently reset your design. `nera update` refreshes the
machinery and leaves your content alone.

If any step fails, your files are restored from `.nera-backup` and the backup
is kept so you can inspect it.

### Example

```bash
cd my-website
nera update
npm run dev
```

## 🧪 Development

Clone the installer and run tests with:

```bash
npm install
npx vitest run     # `npm test` starts vitest in watch mode
npm run lint
```

Or run a specific test file:

```bash
npx vitest run test/create.test.js
npx vitest run test/update.test.js
npx vitest run test/update.integration.test.js
```

The suite clones from a local git fixture (`test/helpers/fixture-repo.js`)
rather than from GitHub, so it needs no network and does not run `npm install`.

## 🔧 Troubleshooting

If an update fails, the installer will attempt to restore your files from backup automatically. If you encounter issues:

1. Check that you're in a Nera project directory, not a clone of the core
   generator repository — use `git pull` for that. Projects created before
   installer 2.0.0 have no `nera.version` metadata; that is fine, the version
   is simply reported as unknown and recorded on the next update
2. Ensure you have internet access for downloading updates
3. Make sure you have write permissions in the project directory
4. Try running the command with elevated permissions if needed

## 📁 Project Structure

```
.
├── bin/             # CLI entrypoint
├── src/             # Internal logic
├── test/            # Vitest test files
└── package.json
```

## 🧑‍💻 Author

Michael Becker
[GitHub](https://github.com/seebaermichi)

## 📦 License

MIT
