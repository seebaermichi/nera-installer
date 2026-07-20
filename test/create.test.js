import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fssync from 'fs'
import path from 'path'
import os from 'os'
import { createProject, validateProjectName } from '../src/create.js'
import { createFixtureRepo } from './helpers/fixture-repo.js'

/**
 * Clones from a local git fixture rather than github.com/seebaermichi/nera, and
 * skips the dependency install, so the suite is deterministic and needs no
 * network. The clone/strip/personalize path being exercised is the real one.
 */

const createTempDir = () =>
    path.join(
        os.tmpdir(),
        `.nera-installer-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

const requiredFiles = [
    'package.json',
    path.join('config', 'app.yaml'),
    'index.js',
]

describe('createProject', () => {
    let tempDir
    let repoDir
    let originalCwd

    beforeEach(async () => {
        originalCwd = process.cwd()
        tempDir = createTempDir()
        repoDir = path.join(tempDir, 'generator.git')
        await fs.mkdir(tempDir, { recursive: true })
        await createFixtureRepo(repoDir, '4.3.0')
        process.chdir(tempDir)
    })

    afterEach(async () => {
        process.chdir(originalCwd)
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    it('clones and prepares a Nera project with required files', async () => {
        const projectName = 'test-site'
        const projectPath = path.join(tempDir, projectName)

        await createProject(projectName, { repoUrl: repoDir, install: false })

        for (const file of requiredFiles) {
            expect(fssync.existsSync(path.join(projectPath, file))).toBe(true)
        }

        expect(fssync.existsSync(path.join(projectPath, '.git'))).toBe(false)
    })

    it('stamps the version of the generator it actually cloned', async () => {
        await createProject('stamped', { repoUrl: repoDir, install: false })

        const pkg = JSON.parse(
            await fs.readFile(path.join(tempDir, 'stamped', 'package.json'), 'utf-8')
        )

        expect(pkg.nera).toEqual({ version: '4.3.0' })
    })

    describe('validateProjectName', () => {
        it('accepts ordinary project names', () => {
            for (const name of ['site', 'my-site', 'my_site', 'site.v2', 'Site2']) {
                expect(() => validateProjectName(name)).not.toThrow()
            }
        })

        it('rejects names that are unsafe as a directory or an argument', () => {
            const rejected = [
                '',
                '   ',
                'my site',
                'a; touch pwned',
                'a && echo hi',
                'a|b',
                '$(whoami)',
                '`whoami`',
                '../escape',
                'nested/path',
                '-rf',
                '.hidden',
                undefined,
            ]

            for (const name of rejected) {
                expect(
                    () => validateProjectName(name),
                    `expected ${JSON.stringify(name)} to be rejected`
                ).toThrow()
            }
        })
    })
})
