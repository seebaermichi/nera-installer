#!/usr/bin/env node
import { createProject } from '../src/create.js'
import { updateProject } from '../src/update.js'

const [, , command, projectName] = process.argv

try {
    if (command === 'new' && projectName) {
        await createProject(projectName)
    } else if (command === 'update') {
        await updateProject()
    } else {
        console.log('Usage: nera new <project-name> | nera update')
        process.exit(1)
    }
} catch (error) {
    // Handle errors at the CLI level
    console.error('❌ Command failed:', error.message)
    process.exit(1)
}
