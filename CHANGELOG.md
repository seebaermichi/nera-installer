# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-20

### Fixed

-   **BREAKING**: `nera update` now works. Every project `nera new` produced was
    permanently rejected by the update guard: `create` cloned the generator and
    removed only `.git`, so the project kept `name: "nera"` and the upstream
    `repository.url`, which is exactly the "this is the core repository" shape
    `update` refuses. The command has never succeeded since it was introduced
    in 1.1.0
-   **BREAKING**: `nera new` now makes the scaffold the user's own project. It
    sets `name` to the project name, resets `version` to `1.0.0`, removes the
    generator's `repository`, `bugs` and `homepage`, and records the version of
    the generator it cloned under `nera.version`
-   **BREAKING**: a missing `nera.version` is no longer fatal. `update`
    previously required the key, which nothing has ever written — the generator
    declares no `nera` key at all — so even a hand-repaired project was refused.
    Projects created before 2.0.0 are now accepted and stamped on their first
    update
-   **BREAKING**: the backup is no longer deleted before `npm install`. A failed
    dependency install — network, peer conflict, entirely routine — previously
    left core files already overwritten, the backup already removed, and the
    rollback path throwing `No backup found to restore from`. The backup now
    outlives every fallible step and is kept, not deleted, when one fails
-   `nera.version` now advances on update. `mergePackageJson` spread
    `newPackageJson.nera` over the current value, which is a no-op against a
    generator that has no `nera` key, so the stamp froze at whatever was first
    written. 1.1.1 released this as fixed, but the change had only ever been
    made to the copy of the function inside the test file
-   `update` no longer reintroduces the generator's `repository`, `bugs` and
    `homepage` into the user's `package.json` during the merge
-   `.nera-temp` is cleaned up on failure, so a retry no longer aborts with
    `destination path '.nera-temp' already exists`
-   project names containing spaces or shell metacharacters are handled safely.
    `git clone` was invoked through a shell with the name interpolated
    unquoted, so `nera new "my site"` cloned into `my`, and any metacharacter
    was injected verbatim. The name is now validated and passed as a single
    argument
-   a failure before anything was modified no longer prints
    `Failed to restore from backup` and `You may need to manually restore your
    project` over an untouched project

### Changed

-   **BREAKING**: `update` no longer copies `views/`. It previously listed
    `views/_defaults/`, a directory that does not exist in the generator, so the
    line silently did nothing. Rather than pointing it at the real `views/`,
    this is now deliberate: a Nera site *is* a clone of the generator, so
    `views/layouts/layout.pug` is the user's own site layout, and refreshing it
    from a clone would silently reset their design. `update` refreshes `src/`
    and merges `package.json`
-   `createProject` throws on failure instead of calling `process.exit(1)`. The
    CLI already handled the error and exited 1, so behaviour at the command line
    is unchanged
-   `createProject` and `updateProject` accept an options object
    (`repoUrl`, `install`) so the clone source and the dependency install can be
    substituted. The CLI passes neither and behaves as before

### Added

-   `LICENSE` — MIT was declared in `package.json` with no license file present
-   `publishConfig.access: public`, so the scoped package does not depend on
    already being public on the registry
-   `.github/workflows/publish.yml` — tag-triggered release via npm trusted
    publishing (OIDC), matching the rest of the fleet

### Removed

-   tracked duplicates `.gitignore copy` and `.github copy/workflows/test.yml`.
    The useful entries from the former were folded into `.gitignore`, which now
    also ignores `.npmrc`

### Migration from v1.x

Existing projects keep working, and `nera update` will now accept them as they
are — that is the point of this release. Nothing is required of you.

The first `nera update` after upgrading will record a `nera.version` in your
`package.json` and, if your project still carries them, leave the generator's
`repository`, `bugs` and `homepage` fields untouched rather than refreshing
them. If your project was scaffolded by 1.x and still identifies itself as the
generator, you can make that explicit at any time:

```jsonc
{
    "name": "my-website",     // was "nera"
    "version": "1.0.0",       // was the generator's version
    "nera": { "version": "4.3.0" }
    // remove "repository", "bugs" and "homepage" if they still point at
    // github.com/seebaermichi/nera
}
```

Two behaviour changes to be aware of:

-   `nera update` no longer touches `views/`. If you were relying on it to
    deliver updated layouts, copy them across by hand from a fresh clone.
-   Project names are now validated. A name that previously produced a broken,
    half-created directory — anything with a space or a shell metacharacter —
    is now rejected up front with an explanation.

## [1.1.1] - 2025-08-02

### Fixed
- **Package.json merging**: Fixed issue where `nera.version` wasn't being updated to the latest Nera core version
- **Core repository detection**: Improved validation to properly handle the core Nera repository vs user projects
- **Version preservation**: Ensured user's project version is always preserved during updates

### Changed
- Updated `nera.version` to use the main version from the cloned Nera repository
- Enhanced error messages to provide clearer guidance for different project types
- Updated test suite to reflect the corrected merging behavior

## [1.1.0] - 2025-08-02

### Added
- **Update functionality**: New `nera update` command to update existing Nera projects
- Automatic backup and restore of user files (`pages/`, `assets/`, `config/app.yaml`)
- Smart package.json merging that preserves user settings while updating dependencies
- Comprehensive error handling with automatic rollback on update failure
- Full test suite for update functionality
- Troubleshooting section in README

### Changed
- Updated CLI to support both `new` and `update` commands
- Enhanced README with detailed update instructions and examples
- Improved error handling throughout the codebase

### Technical Details
- Added `/src/update.js` with core update logic
- Added helper functions for file backup, restoration, and directory copying
- Added intelligent package.json merging that preserves user scripts and metadata
- Updated `/bin/cli.js` to handle both commands with proper error handling
- Added comprehensive test coverage for all update scenarios

## [1.0.0] - 2025-01-XX

### Added
- Initial release of Nera Installer
- `nera new <project-name>` command to create new Nera projects
- Automatic cloning of official Nera starter template
- Automatic removal of `.git` folder from cloned template
- Automatic dependency installation with `npm install`
- Basic CLI structure and error handling
- Comprehensive test suite for project creation
- Complete documentation and usage examples

### Features
- Simple and intuitive command-line interface
- Reliable project scaffolding from GitHub template
- Cross-platform compatibility
- Detailed logging and user feedback
