# 🛠️ Nera Installer

A simple CLI tool to create new [Nera](https://github.com/seebaermichi/nera) static site projects.

## 📦 Installation

```bash
npm install -g @nera-static/installer
```

## 🚀 Usage

### Create new project
```bash
nera new <project-name>
```

This will:

1. Clone the official Nera starter template
2. Remove the `.git` folder
3. Run `npm install`
4. Print next steps

### Example

```bash
nera new my-website
cd my-website
npm run dev
```

### Update existing project
```bash
nera update
```

**⚠️ Important:** Always commit your changes before running `nera update` to ensure you can revert if needed.

This will:

1. Check that you're in a Nera project
2. Create a backup of `assets/`, `config/` and `pages/` folder
3. Clone the latest main branch from https://github.com/seebaermichi/nera.git
4. Update all files in `src/` and `views/_defaults/`, and merge `package.json`
5. Restore backup files
6. Install updated dependencies

### Example

```bash
cd my-website
nera update
npm run dev
```

## 🧪 Development

Clone the installer and run tests with:

```bash
npm install
npm test
```

Or run a specific test file:

```bash
npx vitest run test/create.test.js
npx vitest run test/update.test.js
```

## 🔧 Troubleshooting

If an update fails, the installer will attempt to restore your files from backup automatically. If you encounter issues:

1. Check that you're in a Nera project directory (must have `package.json` with `nera` metadata)
2. Ensure you have internet access for downloading updates
3. Make sure you have write permissions in the project directory
4. Try running the command with elevated permissions if needed

## 📁 Project Structure

```
.
├── bin/             # CLI entrypoint
├── src/             # Internal logic
├── test/            # Vitest test files
└── package.json
```

## 🧑‍💻 Author

Michael Becker
[GitHub](https://github.com/seebaermichi)

## 📦 License

MIT
