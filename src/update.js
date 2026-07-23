import { execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export const NERA_REPO_URL = 'https://github.com/seebaermichi/nera.git'

// Note: projects scaffolded before installer 2.0.0 carry no `nera.version`
// stamp. They are the projects this release exists to unbreak, so a missing
// stamp is reported and tolerated rather than treated as fatal.
const defaultInstallDependencies = () =>
    execFileSync('npm', ['install'], { stdio: 'inherit' })

const pathExists = async (p) => {
    try {
        await fs.access(p)
        return true
    } catch {
        return false
    }
}

export async function updateProject(options = {}) {
    const {
        repoUrl = NERA_REPO_URL,
        install = true,
        // Injectable so the rollback-on-failed-install path can be tested; a
        // real npm failure cannot be provoked reliably from a test.
        installDependencies = defaultInstallDependencies,
    } = options

    // Only attempt a rollback if there is something to roll back to. Restoring
    // unconditionally makes every early validation failure print an alarming
    // "you may need to manually restore your project" over an untouched project.
    let backupCreated = false

    try {
        console.log('🔍 Checking if this is a Nera project...')

        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))

        // Check if this is the core Nera repository
        if (packageJson.name === 'nera' && packageJson.repository?.url?.includes('seebaermichi/nera')) {
            console.log('🔧 This appears to be the core Nera repository.')
            console.log('💡 To update the core repository, use:')
            console.log('   git pull origin main')
            console.log('   npm install')
            throw new Error('Use git pull to update the core Nera repository')
        }

        const currentVersion = packageJson.nera?.version
        if (currentVersion) {
            console.log(`📦 Current Nera version: ${currentVersion}`)
        } else {
            console.log('📦 No Nera version recorded — assuming a pre-2.0.0 project.')
        }
        console.log('🔄 Starting update process...')

        // Backup user files. Revised theme layout (generator ROADMAP-themes.md
        // §1b, 2026-07-23): a site groups its presentation under `theme/`.
        // During the deprecation window a site may still use the legacy root
        // `views/`+`assets/`, so back up whichever the site actually has — its
        // own layouts and assets must survive the update either way.
        const userFiles = ['pages/', 'config/app.yaml']
        if (await pathExists('theme')) {
            userFiles.push('theme/')
        } else {
            userFiles.push('views/', 'assets/')
        }
        await backupFiles(userFiles)
        backupCreated = true

        // Clone latest Nera
        console.log('📥 Downloading latest Nera version...')
        execFileSync('git', ['clone', repoUrl, '.nera-temp'], { stdio: 'inherit' })

        // Update core files. Only `src/` and `package.json` are refreshed, so a
        // site's presentation — legacy root `views/`/`assets/`, or `theme/`
        // under the revised §1b layout — is never overwritten by the clone: it
        // is the user's own design, not a vendor file. Copying it from a fresh
        // clone would silently reset their site.
        console.log('🔧 Updating core files...')
        await updateCoreFiles([
            'src/',
            'package.json' // Merge dependencies
        ])

        // Restore user files
        console.log('📂 Restoring your files...')
        await restoreFiles(userFiles)

        // Install updated dependencies. This is fallible -- network, peer
        // conflicts -- so the backup must still exist while it runs.
        if (install) {
            console.log('📦 Installing updated dependencies...')
            await installDependencies()
        }

        // Only now, past the last fallible step, is the backup safe to drop.
        await fs.rm('.nera-backup', { recursive: true, force: true })

        console.log('✅ Updated to latest Nera version!')
        console.log('👉 Run `npm run dev` to start developing')

    } catch (error) {
        console.error('❌ Update failed:', error.message)

        if (backupCreated) {
            try {
                console.log('🔄 Attempting to restore from backup...')
                await restoreFromBackup()
                console.log('✅ Restored from backup successfully')
                console.log('💡 The backup was kept at .nera-backup')
            } catch (restoreError) {
                console.error('❌ Failed to restore from backup:', restoreError.message)
                console.error('⚠️  Your files are still in .nera-backup — restore them manually')
            }
        }

        // Re-throw the original error instead of calling process.exit
        // This allows proper error handling in both CLI and test environments
        throw error
    } finally {
        // Always, so a failed run does not leave a stale .nera-temp that makes
        // the next `nera update` abort with "destination path already exists".
        await fs.rm('.nera-temp', { recursive: true, force: true })
    }
}

async function backupFiles(filePaths) {
    console.log('💾 Creating backup...')

    // Create backup directory
    await fs.mkdir('.nera-backup', { recursive: true })

    for (const filePath of filePaths) {
        try {
            const stats = await fs.stat(filePath)
            const backupPath = path.join('.nera-backup', filePath)

            if (stats.isDirectory()) {
                // Copy directory recursively
                await copyDirectory(filePath, backupPath)
            } else {
                // Copy file
                await fs.mkdir(path.dirname(backupPath), { recursive: true })
                await fs.copyFile(filePath, backupPath)
            }

            console.log(`  ✓ Backed up ${filePath}`)
        } catch (error) {
            // File/directory doesn't exist, skip it
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
                // Copy directory recursively
                await copyDirectory(sourcePath, filePath)
                console.log(`  ✓ Updated ${filePath}`)
            } else if (filePath === 'package.json') {
                // Special handling for package.json - merge dependencies
                await mergePackageJson(sourcePath, filePath)
                console.log(`  ✓ Merged ${filePath}`)
            } else {
                // Copy file
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
                // Restore directory recursively
                await copyDirectory(backupPath, filePath)
            } else {
                // Restore file
                await fs.mkdir(path.dirname(filePath), { recursive: true })
                await fs.copyFile(backupPath, filePath)
            }

            console.log(`  ✓ Restored ${filePath}`)
        } catch (error) {
            // Backup doesn't exist, skip it
            if (error.code !== 'ENOENT') {
                console.warn(`  ⚠️  Failed to restore ${filePath}:`, error.message)
            }
        }
    }
}

async function restoreFromBackup() {
    const backupDir = '.nera-backup'

    try {
        await fs.access(backupDir)
    } catch {
        throw new Error('No backup found to restore from')
    }

    // Restore all backed up files
    const backupContents = await fs.readdir(backupDir)

    for (const item of backupContents) {
        const backupPath = path.join(backupDir, item)
        const restorePath = item

        const stats = await fs.stat(backupPath)

        if (stats.isDirectory()) {
            await copyDirectory(backupPath, restorePath)
        } else {
            await fs.copyFile(backupPath, restorePath)
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

    // Preserve user's project-specific fields
    const merged = {
        ...newPackageJson,
        name: currentPackageJson.name, // Keep user's project name
        description: currentPackageJson.description || newPackageJson.description,
        version: currentPackageJson.version, // Keep user's project version
        author: currentPackageJson.author || newPackageJson.author,

        // Merge dependencies (new ones take precedence for version conflicts)
        dependencies: {
            ...currentPackageJson.dependencies,
            ...newPackageJson.dependencies
        },
        devDependencies: {
            ...currentPackageJson.devDependencies,
            ...newPackageJson.devDependencies
        },

        // Keep user's scripts but merge with new ones
        scripts: {
            ...newPackageJson.scripts,
            ...currentPackageJson.scripts // User scripts take precedence
        },

        // Record the version actually cloned. Spreading `newPackageJson.nera`
        // here instead would be a no-op -- the generator declares no `nera`
        // key -- which would freeze the stamp at whatever `create` first wrote.
        nera: {
            ...currentPackageJson.nera,
            version: newPackageJson.version
        }
    }

    // `...newPackageJson` above drags the generator's own repository metadata
    // in. Keep whatever the user had, including nothing.
    for (const field of ['repository', 'bugs', 'homepage']) {
        if (currentPackageJson[field] === undefined) {
            delete merged[field]
        } else {
            merged[field] = currentPackageJson[field]
        }
    }

    await fs.writeFile(
        currentPackageJsonPath,
        `${JSON.stringify(merged, null, 2)}\n`
    )
}
