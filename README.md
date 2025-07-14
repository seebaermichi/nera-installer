# 🛠️ Nera Installer

A simple CLI tool to create new [Nera](https://github.com/seebaermichi/nera) static site projects.

## 📦 Installation

```bash
npm install -g @nera-static/installer
```

## 🚀 Usage

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

## 🧪 Development

Clone the installer and run tests with:

```bash
npm install
npm test
```

Or run a specific test file:

```bash
npx vitest run test/create.test.js
```

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
