#!/usr/bin/env node
import { createProject } from '../src/create.js'

const [, , command, projectName] = process.argv

if (command === 'new' && projectName) {
  await createProject(projectName)
} else {
  console.log('Usage: nera new <project-name>')
  process.exit(1)
}
