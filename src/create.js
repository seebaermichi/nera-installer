import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export async function createProject(projectName) {
  const targetDir = path.resolve(process.cwd(), projectName)

  console.log(`📦 Creating new Nera project in ${targetDir}...`)
  try {
    // Clone the GitHub starter repo
    execSync(`git clone https://github.com/seebaermichi/nera.git ${projectName}`, {
      stdio: 'inherit'
    })

    // Remove .git directory
    const gitDir = path.join(targetDir, '.git')
    await fs.rm(gitDir, { recursive: true, force: true })

    // Install dependencies
    console.log('📦 Installing dependencies...')
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' })

    console.log('✅ Done!')
    console.log(`👉 Next steps:
  cd ${projectName}
  npm run dev
`)
  } catch (error) {
    console.error('❌ Failed to create project:', error.message)
    process.exit(1)
  }
}
