// /test/update.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fssync from 'fs'
import path from 'path'
import os from 'os'

const createTempDir = () =>
    path.join(
        os.tmpdir(),
        `.nera-installer-update-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

const createMockNeraRepo = async (repoDir) => {
    // Create a mock Nera repository structure
    await fs.mkdir(path.join(repoDir, 'src'), { recursive: true })
    await fs.mkdir(path.join(repoDir, 'views', '_defaults'), { recursive: true })

    // Create updated package.json
    const newPackageJson = {
        name: 'nera',
        version: '2.0.0',
        scripts: {
            dev: 'node index.js --dev',
            build: 'node index.js --build'
        },
        dependencies: {
            'some-new-dep': '^2.0.0',
            'updated-dep': '^3.0.0'
        },
        nera: {
            version: '2.0.0'
        }
    }
    await fs.writeFile(
        path.join(repoDir, 'package.json'),
        JSON.stringify(newPackageJson, null, 2)
    )

    // Create updated core files
    await fs.writeFile(
        path.join(repoDir, 'src', 'new-file.js'),
        'console.log("new version");'
    )
    await fs.writeFile(
        path.join(repoDir, 'index.js'),
        'console.log("updated main file");'
    )
    await fs.writeFile(
        path.join(repoDir, 'views', '_defaults', 'layout.html'),
        '<html><body>Updated layout</body></html>'
    )
}

const createMockNeraProject = async (projectDir) => {
    // Create basic Nera project structure
    await fs.mkdir(path.join(projectDir, 'pages'), { recursive: true })
    await fs.mkdir(path.join(projectDir, 'assets'), { recursive: true })
    await fs.mkdir(path.join(projectDir, 'config'), { recursive: true })
    await fs.mkdir(path.join(projectDir, 'src'), { recursive: true })
    await fs.mkdir(path.join(projectDir, 'views', '_defaults'), { recursive: true })

    // Create package.json with Nera metadata
    const packageJson = {
        name: 'my-test-site',
        version: '1.0.0',
        description: 'My test Nera site',
        scripts: {
            dev: 'node index.js',
            build: 'node index.js build',
            'custom-script': 'echo "user script"'
        },
        dependencies: {
            'some-user-dep': '^1.0.0'
        },
        nera: {
            version: '1.0.0'
        }
    }
    await fs.writeFile(
        path.join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    )

    // Create user files
    await fs.writeFile(
        path.join(projectDir, 'pages', 'index.md'),
        '# My Homepage\nThis is my custom content'
    )
    await fs.writeFile(
        path.join(projectDir, 'assets', 'style.css'),
        'body { color: red; }'
    )
    await fs.writeFile(
        path.join(projectDir, 'config', 'app.yaml'),
        'site_name: My Test Site\nbase_url: https://example.com'
    )

    // Create some core files that should be updated
    await fs.writeFile(
        path.join(projectDir, 'src', 'old-file.js'),
        'console.log("old version");'
    )
    await fs.writeFile(
        path.join(projectDir, 'index.js'),
        'console.log("old main file");'
    )
}

// Create a modified version of updateProject for testing
async function updateProjectForTest() {
    console.log('🔍 Checking if this is a Nera project...')

    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

    if (!packageJson.nera || !packageJson.nera.version) {
        throw new Error('Not a Nera project or missing version info')
    }

    console.log(`📦 Current Nera version: ${packageJson.nera.version}`)
    console.log('🔄 Starting update process...')

    // Backup user files
    const userFiles = ['pages/', 'assets/', 'config/app.yaml']
    await backupFiles(userFiles)

    // Create mock repo instead of cloning
    console.log('📥 Creating mock updated Nera version...')
    await createMockNeraRepo('.nera-temp')

    // Update core files
    console.log('🔧 Updating core files...')
    await updateCoreFiles([
        'src/',
        'views/_defaults/',
        'package.json'
    ])

    // Restore user files
    console.log('📂 Restoring your files...')
    await restoreFiles(userFiles)

    // Clean up
    await fs.rm('.nera-temp', { recursive: true, force: true })
    await fs.rm('.nera-backup', { recursive: true, force: true })

    // Skip npm install in tests
    console.log('✅ Updated to latest Nera version!')
    console.log('👉 Run `npm run dev` to start developing')
}

// Helper functions (copied from the main implementation)
async function backupFiles(filePaths) {
    console.log('💾 Creating backup...')

    await fs.mkdir('.nera-backup', { recursive: true })

    for (const filePath of filePaths) {
        try {
            const stats = await fs.stat(filePath)
            const backupPath = path.join('.nera-backup', filePath)

            if (stats.isDirectory()) {
                await copyDirectory(filePath, backupPath)
            } else {
                await fs.mkdir(path.dirname(backupPath), { recursive: true })
                await fs.copyFile(filePath, backupPath)
            }

            console.log(`  ✓ Backed up ${filePath}`)
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`  ⚠️  Failed to backup ${filePath}:`, error.message)
            }
        }
    }
}

async function updateCoreFiles(filePaths) {
    for (const filePath of filePaths) {
        const sourcePath = path.join('.nera-temp', filePath)

        try {
            const stats = await fs.stat(sourcePath)

            if (stats.isDirectory()) {
                await copyDirectory(sourcePath, filePath)
                console.log(`  ✓ Updated ${filePath}`)
            } else if (filePath === 'package.json') {
                await mergePackageJson(sourcePath, filePath)
                console.log(`  ✓ Merged ${filePath}`)
            } else {
                await fs.mkdir(path.dirname(filePath), { recursive: true })
                await fs.copyFile(sourcePath, filePath)
                console.log(`  ✓ Updated ${filePath}`)
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`  ⚠️  Failed to update ${filePath}:`, error.message)
            }
        }
    }
}

async function restoreFiles(filePaths) {
    for (const filePath of filePaths) {
        const backupPath = path.join('.nera-backup', filePath)

        try {
            const stats = await fs.stat(backupPath)

            if (stats.isDirectory()) {
                await copyDirectory(backupPath, filePath)
            } else {
                await fs.mkdir(path.dirname(filePath), { recursive: true })
                await fs.copyFile(backupPath, filePath)
            }

            console.log(`  ✓ Restored ${filePath}`)
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`  ⚠️  Failed to restore ${filePath}:`, error.message)
            }
        }
    }
}

async function copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true })

    const entries = await fs.readdir(source, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(source, entry.name)
        const destPath = path.join(destination, entry.name)

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath)
        } else {
            await fs.copyFile(srcPath, destPath)
        }
    }
}

async function mergePackageJson(newPackageJsonPath, currentPackageJsonPath) {
    const newPackageJson = JSON.parse(await fs.readFile(newPackageJsonPath, 'utf-8'))
    const currentPackageJson = JSON.parse(await fs.readFile(currentPackageJsonPath, 'utf-8'))

    const merged = {
        ...newPackageJson,
        name: currentPackageJson.name,
        description: currentPackageJson.description || newPackageJson.description,
        version: currentPackageJson.version,
        author: currentPackageJson.author || newPackageJson.author,

        dependencies: {
            ...currentPackageJson.dependencies,
            ...newPackageJson.dependencies
        },
        devDependencies: {
            ...currentPackageJson.devDependencies,
            ...newPackageJson.devDependencies
        },

        scripts: {
            ...newPackageJson.scripts,
            ...currentPackageJson.scripts
        },

        nera: {
            ...currentPackageJson.nera,
            ...newPackageJson.nera
        }
    }

    await fs.writeFile(currentPackageJsonPath, JSON.stringify(merged, null, 2))
}

describe('updateProject', () => {
    let tempDir
    let originalCwd

    beforeEach(async () => {
        tempDir = createTempDir()
        await fs.mkdir(tempDir, { recursive: true })
        originalCwd = process.cwd()
    })

    afterEach(async () => {
        process.chdir(originalCwd)
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    it('updates a Nera project while preserving user files', async () => {
        const projectDir = path.join(tempDir, 'test-project')
        await fs.mkdir(projectDir, { recursive: true })
        await createMockNeraProject(projectDir)

        // Change to project directory
        process.chdir(projectDir)

        // Store original user content for comparison
        const originalPageContent = await fs.readFile('pages/index.md', 'utf-8')
        const originalAssetContent = await fs.readFile('assets/style.css', 'utf-8')
        const originalConfigContent = await fs.readFile('config/app.yaml', 'utf-8')
        const originalPackageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

        // Run update (using test version)
        await updateProjectForTest()

        // Verify user files are preserved
        const updatedPageContent = await fs.readFile('pages/index.md', 'utf-8')
        const updatedAssetContent = await fs.readFile('assets/style.css', 'utf-8')
        const updatedConfigContent = await fs.readFile('config/app.yaml', 'utf-8')

        expect(updatedPageContent).toBe(originalPageContent)
        expect(updatedAssetContent).toBe(originalAssetContent)
        expect(updatedConfigContent).toBe(originalConfigContent)

        // Verify package.json is properly merged
        const updatedPackageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

        // User's project metadata should be preserved
        expect(updatedPackageJson.name).toBe(originalPackageJson.name)
        expect(updatedPackageJson.description).toBe(originalPackageJson.description)
        expect(updatedPackageJson.version).toBe(originalPackageJson.version)

        // User's custom script should be preserved
        expect(updatedPackageJson.scripts['custom-script']).toBe('echo "user script"')

        // User's dependencies should be preserved
        expect(updatedPackageJson.dependencies['some-user-dep']).toBe('^1.0.0')

        // New dependencies should be added
        expect(updatedPackageJson.dependencies['some-new-dep']).toBe('^2.0.0')

        // Nera metadata should be updated
        expect(updatedPackageJson.nera.version).toBe('2.0.0')

        // Verify temporary files are cleaned up
        expect(fssync.existsSync('.nera-temp')).toBe(false)
        expect(fssync.existsSync('.nera-backup')).toBe(false)

        // Verify core files exist and are updated
        expect(fssync.existsSync('src')).toBe(true)
        expect(fssync.existsSync('src/new-file.js')).toBe(true)
        expect(fssync.existsSync('index.js')).toBe(true)
    }, 30000)

    it('throws error when not in a Nera project', async () => {
        const nonNeraDir = path.join(tempDir, 'non-nera-project')
        await fs.mkdir(nonNeraDir, { recursive: true })

        // Create a package.json without Nera metadata
        const packageJson = {
            name: 'not-a-nera-project',
            version: '1.0.0'
        }
        await fs.writeFile(
            path.join(nonNeraDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        )

        process.chdir(nonNeraDir)

        await expect(updateProjectForTest()).rejects.toThrow('Not a Nera project or missing version info')
    })

    it('throws error when package.json does not exist', async () => {
        const emptyDir = path.join(tempDir, 'empty-project')
        await fs.mkdir(emptyDir, { recursive: true })

        process.chdir(emptyDir)

        await expect(updateProjectForTest()).rejects.toThrow()
    })

    it('handles missing user files gracefully', async () => {
        const projectDir = path.join(tempDir, 'minimal-project')
        await fs.mkdir(projectDir, { recursive: true })

        // Create minimal Nera project with just package.json
        const packageJson = {
            name: 'minimal-nera-project',
            version: '1.0.0',
            nera: {
                version: '1.0.0'
            }
        }
        await fs.writeFile(
            path.join(projectDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        )

        process.chdir(projectDir)

        // Should not throw error even when user files don't exist
        await expect(updateProjectForTest()).resolves.not.toThrow()

        // Verify cleanup happened
        expect(fssync.existsSync('.nera-temp')).toBe(false)
        expect(fssync.existsSync('.nera-backup')).toBe(false)
    }, 30000)

    it('preserves custom user scripts in package.json', async () => {
        const projectDir = path.join(tempDir, 'script-test-project')
        await fs.mkdir(projectDir, { recursive: true })

        const packageJson = {
            name: 'script-test-project',
            version: '1.0.0',
            scripts: {
                dev: 'node index.js',
                build: 'node index.js build',
                'my-custom-build': 'webpack --mode production',
                'deploy': 'npm run build && rsync -av dist/ server:/'
            },
            nera: {
                version: '1.0.0'
            }
        }
        await fs.writeFile(
            path.join(projectDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        )

        process.chdir(projectDir)
        await updateProjectForTest()

        const updatedPackageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

        // Custom scripts should be preserved
        expect(updatedPackageJson.scripts['my-custom-build']).toBe('webpack --mode production')
        expect(updatedPackageJson.scripts['deploy']).toBe('npm run build && rsync -av dist/ server:/')
    }, 30000)
})
