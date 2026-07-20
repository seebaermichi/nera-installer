import { execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

/**
 * Builds a local git repository shaped like the Nera generator, so the
 * installer's real clone path can be exercised without network access.
 *
 * The defaults mirror generator/package.json as of 4.3.0: unscoped name
 * "nera", and an upstream repository URL. Both are what `create` has to strip
 * for `nera update` to accept the project afterwards.
 */

const git = (cwd, args) =>
    execFileSync('git', args, {
        cwd,
        stdio: 'pipe',
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'Nera Test',
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'Nera Test',
            GIT_COMMITTER_EMAIL: 'test@example.com',
        },
    })

const write = async (repoDir, filePath, contents) => {
    const target = path.join(repoDir, filePath)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, contents)
}

export const generatorPackageJson = (version = '4.3.0') => ({
    name: 'nera',
    version,
    description: 'A simple static site generator',
    main: 'index.js',
    type: 'module',
    scripts: {
        render: 'node index.js',
        dev: 'node index.js --dev',
    },
    dependencies: {
        'markdown-it': '^14.0.0',
    },
    repository: {
        type: 'git',
        url: 'https://github.com/seebaermichi/nera',
    },
    bugs: { url: 'https://github.com/seebaermichi/nera/issues' },
    homepage: 'https://github.com/seebaermichi/nera#readme',
    license: 'MIT',
})

export async function createFixtureRepo(repoDir, version = '4.3.0') {
    await fs.mkdir(repoDir, { recursive: true })

    await write(repoDir, 'package.json', JSON.stringify(generatorPackageJson(version), null, 2))
    await write(repoDir, 'index.js', 'console.log(\'nera\')\n')
    await write(repoDir, 'src/index.js', 'export function run() {}\n')
    await write(repoDir, 'views/layouts/layout.pug', 'doctype html\nhtml\n  body\n    block content\n')
    await write(repoDir, 'views/pages/default.pug', 'extends ../layouts/layout.pug\n')
    await write(repoDir, 'config/app.yaml', 'lang: en\n')
    await write(repoDir, 'pages/index.md', '---\nlayout: pages/default.pug\n---\n\n# Home\n')

    git(repoDir, ['init', '-q', '-b', 'main'])
    git(repoDir, ['add', '-A'])
    git(repoDir, ['commit', '-q', '-m', `generator ${version}`])

    return repoDir
}

/**
 * Publishes a newer generator version into an existing fixture repo, so a
 * subsequent clone picks it up -- this is what `nera update` is meant to fetch.
 */
export async function publishNewVersion(repoDir, version, extraFiles = {}) {
    await write(repoDir, 'package.json', JSON.stringify(generatorPackageJson(version), null, 2))

    for (const [filePath, contents] of Object.entries(extraFiles)) {
        await write(repoDir, filePath, contents)
    }

    git(repoDir, ['add', '-A'])
    git(repoDir, ['commit', '-q', '-m', `generator ${version}`])
}
