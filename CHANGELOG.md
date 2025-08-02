# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
