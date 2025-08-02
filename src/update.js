import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export async function updateProject() {
    try {
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

        // Clone latest Nera
        console.log('📥 Downloading latest Nera version...')
        execSync('git clone https://github.com/seebaermichi/nera.git .nera-temp', { stdio: 'inherit' })

        // Update core files
        console.log('🔧 Updating core files...')
        await updateCoreFiles([
            'src/',
            'views/_defaults/', // New default templates
            'package.json' // Merge dependencies
        ])

        // Restore user files
        console.log('📂 Restoring your files...')
        await restoreFiles(userFiles)

        // Clean up
        await fs.rm('.nera-temp', { recursive: true, force: true })
        await fs.rm('.nera-backup', { recursive: true, force: true })

        // Install updated dependencies
        console.log('📦 Installing updated dependencies...')
        execSync('npm install', { stdio: 'inherit' })

        console.log('✅ Updated to latest Nera version!')
        console.log('👉 Run `npm run dev` to start developing')

    } catch (error) {
        console.error('❌ Update failed:', error.message)

        // Attempt to restore from backup if it exists
        try {
            console.log('🔄 Attempting to restore from backup...')
            await restoreFromBackup()
            console.log('✅ Restored from backup successfully')
        } catch (restoreError) {
            console.error('❌ Failed to restore from backup:', restoreError.message)
            console.error('⚠️  You may need to manually restore your project')
        }

        // Re-throw the original error instead of calling process.exit
        // This allows proper error handling in both CLI and test environments
        throw error
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

        // Update Nera metadata
        nera: {
            ...currentPackageJson.nera,
            ...newPackageJson.nera
        }
    }

    await fs.writeFile(currentPackageJsonPath, JSON.stringify(merged, null, 2))
}
