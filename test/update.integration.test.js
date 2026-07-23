import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fssync from 'fs'
import path from 'path'
import os from 'os'
import { createProject } from '../src/create.js'
import { updateProject } from '../src/update.js'
import { createFixtureRepo, publishNewVersion } from './helpers/fixture-repo.js'

/**
 * End-to-end round trip: `nera new` then `nera update`, both running the real
 * exported functions.
 *
 * The previous test/update.test.js re-implemented updateProject and asserted on
 * its own copies, so src/update.js was never executed by the suite -- which is
 * how a command that could never succeed shipped a green test run. These tests
 * clone from a local git fixture rather than GitHub, so they need no network
 * and still exercise the real clone/copy/merge path.
 */

const createTempDir = () =>
    path.join(
        os.tmpdir(),
        `.nera-installer-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

const readJson = async (...segments) =>
    JSON.parse(await fs.readFile(path.join(...segments), 'utf-8'))

describe('nera new -> nera update round trip', () => {
    let tempDir
    let repoDir
    let originalCwd

    beforeEach(async () => {
        originalCwd = process.cwd()
        tempDir = createTempDir()
        repoDir = path.join(tempDir, 'generator.git')
        await fs.mkdir(tempDir, { recursive: true })
        await createFixtureRepo(repoDir, '4.3.0')
    })

    afterEach(async () => {
        process.chdir(originalCwd)
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    const scaffold = async (projectName = 'roundtrip-site') => {
        process.chdir(tempDir)
        await createProject(projectName, { repoUrl: repoDir, install: false })
        return path.join(tempDir, projectName)
    }

    describe('createProject', () => {
        it('makes the scaffold the user\'s own project, not a copy of the core repo', async () => {
            const projectPath = await scaffold()
            const pkg = await readJson(projectPath, 'package.json')

            expect(pkg.name).toBe('roundtrip-site')
            expect(pkg.repository).toBeUndefined()
            expect(pkg.bugs).toBeUndefined()
            expect(pkg.homepage).toBeUndefined()

            // D6: the stamp is the version of the generator actually cloned
            expect(pkg.nera.version).toBe('4.3.0')

            // the project gets its own version, independent of the generator's
            expect(pkg.version).toBe('1.0.0')

            expect(fssync.existsSync(path.join(projectPath, '.git'))).toBe(false)
            expect(fssync.existsSync(path.join(projectPath, 'index.js'))).toBe(true)
        })

        it('rejects names that would be reinterpreted by the shell', async () => {
            process.chdir(tempDir)

            for (const bad of ['my site', 'a; touch pwned', '../escape', '-rf', '']) {
                await expect(
                    createProject(bad, { repoUrl: repoDir, install: false })
                ).rejects.toThrow()
            }

            // the injection attempt must not have produced any stray artefacts
            const entries = await fs.readdir(tempDir)
            expect(entries.sort()).toEqual(['generator.git'])
        })
    })

    describe('updateProject', () => {
        it('accepts a project that nera new produced', async () => {
            const projectPath = await scaffold()
            process.chdir(projectPath)

            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).resolves.not.toThrow()
        })

        it('advances nera.version to the version actually cloned', async () => {
            const projectPath = await scaffold()
            await publishNewVersion(repoDir, '4.4.0', {
                'src/new-file.js': 'export const added = true\n',
            })

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            const pkg = await readJson(projectPath, 'package.json')
            expect(pkg.nera.version).toBe('4.4.0')

            // core files refreshed
            expect(fssync.existsSync(path.join(projectPath, 'src/new-file.js'))).toBe(true)

            // the project's own identity survives the merge
            expect(pkg.name).toBe('roundtrip-site')
            expect(pkg.version).toBe('1.0.0')
            expect(pkg.repository).toBeUndefined()
        })

        it('preserves a site\'s theme/ presentation and content', async () => {
            const projectPath = await scaffold()

            // The scaffold is theme-shaped (§1b): its presentation lives under
            // theme/. Both the layout and the site's own assets there must
            // survive the update untouched.
            const layoutPath = path.join(projectPath, 'theme/views/layouts/layout.pug')
            const cssPath = path.join(projectPath, 'theme/assets/css/site.css')
            const userLayout = 'doctype html\nhtml\n  body\n    h1 My own design\n'
            const userCss = ':root { --brand: #0b5; }\n'
            await fs.writeFile(layoutPath, userLayout)
            await fs.writeFile(cssPath, userCss)
            await fs.writeFile(path.join(projectPath, 'pages/about.md'), '---\nlayout: pages/default.pug\n---\n\n# About\n')

            await publishNewVersion(repoDir, '4.4.0', {
                'src/new-file.js': 'export const added = true\n',
            })

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            // theme/ is the site's own presentation — never overwritten
            expect(await fs.readFile(layoutPath, 'utf-8')).toBe(userLayout)
            expect(await fs.readFile(cssPath, 'utf-8')).toBe(userCss)
            expect(fssync.existsSync(path.join(projectPath, 'pages/about.md'))).toBe(true)
            // core files still refreshed
            expect(fssync.existsSync(path.join(projectPath, 'src/new-file.js'))).toBe(true)
        })

        it('preserves a legacy root-layout site during the deprecation window', async () => {
            const projectPath = await scaffold()

            // Simulate a site that has not migrated to theme/: its presentation
            // is at the legacy root views/ + assets/. The installer must back
            // up/restore that shape too (§7 revised, the else-branch).
            await fs.rm(path.join(projectPath, 'theme'), { recursive: true, force: true })
            const layoutPath = path.join(projectPath, 'views/layouts/layout.pug')
            const cssPath = path.join(projectPath, 'assets/css/site.css')
            const userLayout = 'doctype html\nhtml\n  body\n    h1 Legacy design\n'
            const userCss = 'body { color: #222; }\n'
            await fs.mkdir(path.dirname(layoutPath), { recursive: true })
            await fs.mkdir(path.dirname(cssPath), { recursive: true })
            await fs.writeFile(layoutPath, userLayout)
            await fs.writeFile(cssPath, userCss)

            await publishNewVersion(repoDir, '4.4.0', {
                'src/new-file.js': 'export const added = true\n',
            })

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            expect(await fs.readFile(layoutPath, 'utf-8')).toBe(userLayout)
            expect(await fs.readFile(cssPath, 'utf-8')).toBe(userCss)
            expect(fssync.existsSync(path.join(projectPath, 'src/new-file.js'))).toBe(true)
        })

        it('tolerates a pre-2.0.0 project with no nera.version stamp', async () => {
            const projectPath = await scaffold()

            // what every project scaffolded by installer 1.x looks like
            const pkg = await readJson(projectPath, 'package.json')
            delete pkg.nera
            await fs.writeFile(
                path.join(projectPath, 'package.json'),
                JSON.stringify(pkg, null, 2)
            )

            process.chdir(projectPath)
            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).resolves.not.toThrow()

            const updated = await readJson(projectPath, 'package.json')
            expect(updated.nera.version).toBe('4.3.0')
        })

        it('still refuses to update a clone of the core repository', async () => {
            const corePath = path.join(tempDir, 'core')
            await createFixtureRepo(corePath, '4.3.0')

            process.chdir(corePath)
            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).rejects.toThrow('Use git pull to update the core Nera repository')
        })

        it('leaves the project recoverable when npm install fails', async () => {
            const projectPath = await scaffold()

            const userPage = '---\nlayout: pages/default.pug\n---\n\n# Important\n'
            await fs.writeFile(path.join(projectPath, 'pages/index.md'), userPage)

            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await expect(
                updateProject({
                    repoUrl: repoDir,
                    installDependencies: () => {
                        throw new Error('npm ERR! peer dependency conflict')
                    },
                })
            ).rejects.toThrow('peer dependency conflict')

            // the backup must survive a failed install, not have been deleted
            // before it -- otherwise there is no recovery path at all
            expect(fssync.existsSync(path.join(projectPath, '.nera-backup'))).toBe(true)
            expect(
                await fs.readFile(path.join(projectPath, 'pages/index.md'), 'utf-8')
            ).toBe(userPage)
        })

        it('cleans up .nera-temp after a failure so a retry can proceed', async () => {
            const projectPath = await scaffold()
            process.chdir(projectPath)

            await expect(
                updateProject({
                    repoUrl: repoDir,
                    installDependencies: () => {
                        throw new Error('install exploded')
                    },
                })
            ).rejects.toThrow('install exploded')

            expect(fssync.existsSync(path.join(projectPath, '.nera-temp'))).toBe(false)

            // and the retry is not blocked by leftover state
            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).resolves.not.toThrow()
        })
    })
})
