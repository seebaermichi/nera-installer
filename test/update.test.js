import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fssync from 'fs'
import path from 'path'
import os from 'os'
import { createProject } from '../src/create.js'
import { updateProject } from '../src/update.js'
import { createFixtureRepo, publishNewVersion } from './helpers/fixture-repo.js'

/**
 * package.json merge semantics and error handling for the real updateProject.
 *
 * This file previously re-implemented updateProject, backupFiles,
 * updateCoreFiles, restoreFiles and mergePackageJson inline and asserted on
 * those copies. src/update.js was never imported, so its only export had 0%
 * coverage and the copies had already drifted from it -- including the error
 * message asserted at the old line 364, which the shipped code never threw.
 */

const createTempDir = () =>
    path.join(
        os.tmpdir(),
        `.nera-installer-update-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

const readJson = async (...segments) =>
    JSON.parse(await fs.readFile(path.join(...segments), 'utf-8'))

describe('updateProject', () => {
    let tempDir
    let repoDir
    let projectPath
    let originalCwd

    beforeEach(async () => {
        originalCwd = process.cwd()
        tempDir = createTempDir()
        repoDir = path.join(tempDir, 'generator.git')
        await fs.mkdir(tempDir, { recursive: true })
        await createFixtureRepo(repoDir, '4.3.0')

        process.chdir(tempDir)
        await createProject('site', { repoUrl: repoDir, install: false })
        projectPath = path.join(tempDir, 'site')
    })

    afterEach(async () => {
        process.chdir(originalCwd)
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    const patchProjectPackageJson = async (patch) => {
        const pkg = await readJson(projectPath, 'package.json')
        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify({ ...pkg, ...patch }, null, 2)
        )
    }

    describe('package.json merging', () => {
        it('adds new dependencies while keeping the user\'s own', async () => {
            await patchProjectPackageJson({
                dependencies: { 'markdown-it': '^14.0.0', 'some-user-dep': '^1.0.0' },
            })
            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            const pkg = await readJson(projectPath, 'package.json')
            expect(pkg.dependencies['some-user-dep']).toBe('^1.0.0')
            expect(pkg.dependencies['markdown-it']).toBe('^14.0.0')
        })

        it('keeps user scripts taking precedence over generator scripts', async () => {
            await patchProjectPackageJson({
                scripts: {
                    render: 'node index.js --custom',
                    'my-custom-build': 'webpack --mode production',
                },
            })
            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            const pkg = await readJson(projectPath, 'package.json')
            expect(pkg.scripts['my-custom-build']).toBe('webpack --mode production')
            expect(pkg.scripts.render).toBe('node index.js --custom')
            // generator scripts the user did not override still arrive
            expect(pkg.scripts.dev).toBe('node index.js --dev')
        })

        it('does not reintroduce the generator\'s repository metadata', async () => {
            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            const pkg = await readJson(projectPath, 'package.json')
            expect(pkg.repository).toBeUndefined()
            expect(pkg.bugs).toBeUndefined()
            expect(pkg.homepage).toBeUndefined()
        })

        it('preserves a repository the user set themselves', async () => {
            const ownRepo = { type: 'git', url: 'https://github.com/someone/my-site' }
            await patchProjectPackageJson({ repository: ownRepo })
            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await updateProject({ repoUrl: repoDir, install: false })

            const pkg = await readJson(projectPath, 'package.json')
            expect(pkg.repository).toEqual(ownRepo)
        })
    })

    describe('error handling', () => {
        it('throws when there is no package.json', async () => {
            const bareDir = path.join(tempDir, 'bare')
            await fs.mkdir(bareDir, { recursive: true })

            process.chdir(bareDir)
            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).rejects.toThrow()
        })

        it('does not claim a restore is needed when nothing was touched', async () => {
            const bareDir = path.join(tempDir, 'bare-2')
            await fs.mkdir(bareDir, { recursive: true })
            process.chdir(bareDir)

            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).rejects.toThrow()

            // the failure happened before any backup existed, so no stray
            // recovery artefacts should have been produced
            expect(fssync.existsSync(path.join(bareDir, '.nera-backup'))).toBe(false)
            expect(fssync.existsSync(path.join(bareDir, '.nera-temp'))).toBe(false)
        })

        it('handles a project missing the optional user directories', async () => {
            await fs.rm(path.join(projectPath, 'assets'), { recursive: true, force: true })
            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await expect(
                updateProject({ repoUrl: repoDir, install: false })
            ).resolves.not.toThrow()

            expect(fssync.existsSync(path.join(projectPath, '.nera-temp'))).toBe(false)
            expect(fssync.existsSync(path.join(projectPath, '.nera-backup'))).toBe(false)
        })

        it('removes the backup on a fully successful run', async () => {
            await publishNewVersion(repoDir, '4.4.0')

            process.chdir(projectPath)
            await updateProject({
                repoUrl: repoDir,
                install: true,
                installDependencies: () => {},
            })

            expect(fssync.existsSync(path.join(projectPath, '.nera-backup'))).toBe(false)
            expect(fssync.existsSync(path.join(projectPath, '.nera-temp'))).toBe(false)
        })
    })
})
