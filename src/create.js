import { execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export const NERA_REPO_URL = 'https://github.com/seebaermichi/nera.git'

// Directory-safe and npm-safe: no separators, no traversal, no leading dot or
// dash, nothing the shell could reinterpret. Deliberately stricter than npm's
// own package-name rules, because this value is also a directory name.
const VALID_PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function validateProjectName(projectName) {
    if (typeof projectName !== 'string' || projectName.trim() === '') {
        throw new Error('Project name is required. Usage: nera new <project-name>')
    }

    if (!VALID_PROJECT_NAME.test(projectName)) {
        throw new Error(
            `Invalid project name "${projectName}". Use letters, digits, dots, ` +
            'dashes and underscores only, starting with a letter or digit.'
        )
    }

    return projectName
}

export async function createProject(projectName, options = {}) {
    const { repoUrl = NERA_REPO_URL, install = true } = options

    validateProjectName(projectName)

    const targetDir = path.resolve(process.cwd(), projectName)

    console.log(`📦 Creating new Nera project in ${targetDir}...`)
    try {
        // execFileSync, not execSync: the project name reaches git as a single
        // argv entry, so spaces and shell metacharacters cannot be reinterpreted
        execFileSync('git', ['clone', repoUrl, projectName], {
            stdio: 'inherit'
        })

        // Remove .git directory
        const gitDir = path.join(targetDir, '.git')
        await fs.rm(gitDir, { recursive: true, force: true })

        // Make the scaffold the user's own project rather than a copy of the
        // core repository. Without this, `nera update` refuses it forever.
        await personalizePackageJson(targetDir, projectName)

        // Install dependencies
        if (install) {
            console.log('📦 Installing dependencies...')
            execFileSync('npm', ['install'], { cwd: targetDir, stdio: 'inherit' })
        }

        console.log('✅ Done!')
        console.log(`👉 Next steps:
  cd ${projectName}
  npm run dev
`)
    } catch (error) {
        console.error('❌ Failed to create project:', error.message)
        throw error
    }
}

async function personalizePackageJson(targetDir, projectName) {
    const packageJsonPath = path.join(targetDir, 'package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

    // The version of the generator that was actually cloned. This is the single
    // source of truth for the stamp -- the generator does not declare a
    // separate `nera` key, and adding one would only give it something to drift
    // against.
    const neraVersion = packageJson.version ?? '0.0.0'

    packageJson.name = projectName
    packageJson.version = '1.0.0'
    packageJson.nera = { ...packageJson.nera, version: neraVersion }

    // These all point at the upstream generator repository. Leaving `repository`
    // in place is half of what makes `nera update` reject the project.
    delete packageJson.repository
    delete packageJson.bugs
    delete packageJson.homepage

    await fs.writeFile(
        packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`
    )

    console.log(`  ✓ Configured project as "${projectName}" (Nera ${neraVersion})`)
}
