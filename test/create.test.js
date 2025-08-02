import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fssync from 'fs'
import path from 'path'
import os from 'os'
import { createProject } from '../src/create.js'

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

    beforeEach(async () => {
        tempDir = createTempDir()
        await fs.mkdir(tempDir, { recursive: true }) // 🔧 ensure the temp dir exists
    })

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    it('clones and prepares a Nera project with required files', async () => {
        const projectName = 'test-site'
        const projectPath = path.join(tempDir, projectName)
        const originalCwd = process.cwd()
        process.chdir(tempDir)

        await createProject(projectName)
        process.chdir(originalCwd)

        for (const file of requiredFiles) {
            const filePath = path.join(projectPath, file)
            const exists = fssync.existsSync(filePath)
            expect(exists).toBe(true)
        }

        const gitDir = path.join(projectPath, '.git')
        expect(fssync.existsSync(gitDir)).toBe(false)
    }, 30000)
})
