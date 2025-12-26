# CommitGenie

A CLI tool that generates intelligent Git commit messages by analyzing your staged code changes using rule-based analysis.

## Features

- Analyzes staged Git changes automatically
- Follows [Conventional Commits](https://www.conventionalcommits.org/) format
- Detects commit types based on file patterns and diff content:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `test:` for test files
  - `chore:` for configuration changes
  - `refactor:` for code refactoring
  - `perf:` for performance improvements
- Automatically determines scope when applicable
- Shows detailed file change statistics
- Error handling for edge cases

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Link the CLI globally (optional):
```bash
npm link
```

## Usage

### Basic Usage

1. Stage your changes:
```bash
git add <files>
```

2. Run CommitGenie:
```bash
npm run dev
# or if linked globally:
commit-genie
```

3. The tool will analyze your changes and suggest a commit message:
```
Analyzing staged changes...

Staged files:
  + src/services/userService.ts
  ~ src/types/index.ts

2 file(s) changed, 45 insertion(s)(+), 3 deletion(s)(-)

Suggested commit message:
──────────────────────────────────────────────────

feat: add userService.ts and update 1 file

──────────────────────────────────────────────────

Breakdown:
  Type: feat
  Description: add userService.ts and update 1 file

To commit with this message, run:
  git commit -m "feat: add userService.ts and update 1 file"
```

### Commands

- `commit-genie` or `commit-genie generate` - Analyze changes and suggest commit message
- `commit-genie gen` - Shorthand for generate
- `commit-genie -c` or `--commit` - Auto-commit with the generated message
- `commit-genie --no-interactive` - Disable interactive prompts
- `commit-genie hook install` - Install git prepare-commit-msg hook
- `commit-genie hook uninstall` - Remove the git hook
- `commit-genie hook status` - Check if hook is installed
- `commit-genie config init` - Create a default config file
- `commit-genie config show` - Show current configuration
- `commit-genie --help` - Show help
- `commit-genie --version` - Show version

### Interactive Mode

By default, CommitGenie runs in interactive mode. After analyzing your changes, you'll be prompted to:
- **[c]** Commit with the suggested message
- **[e]** Edit the message before committing
- **[n]** Cancel and do nothing

### Git Hook Integration

Install a git hook to automatically generate commit messages:

```bash
commit-genie hook install
```

This installs a `prepare-commit-msg` hook that suggests messages when you run `git commit`.

### Configuration

Create a `.commitgenierc.json` file to customize behavior:

```bash
commit-genie config init
```

Example configuration:

```json
{
  "scopes": [
    { "pattern": "src/api", "scope": "api" },
    { "pattern": "src/components", "scope": "ui" }
  ],
  "defaultType": "feat",
  "maxMessageLength": 72
}
```

Configuration options:
- `scopes` - Map file path patterns to commit scopes
- `defaultType` - Default commit type when none is detected
- `maxMessageLength` - Maximum length for commit messages

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with ts-node
- `npm run watch` - Watch mode for development
- `npm start` - Run the compiled version

### Project Structure

```
CommitGenie/
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── commands/
│   │   ├── generate.ts             # Generate command implementation
│   │   ├── hook.ts                 # Git hook management commands
│   │   └── config.ts               # Configuration commands
│   ├── services/
│   │   ├── gitService.ts           # Git operations
│   │   ├── analyzerService.ts      # Change analysis logic
│   │   ├── hookService.ts          # Git hook installation
│   │   └── configService.ts        # Configuration loading
│   ├── utils/
│   │   ├── filePatterns.ts         # File type detection
│   │   └── prompt.ts               # Interactive prompts
│   └── types/
│       └── index.ts                # TypeScript type definitions
├── dist/                           # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Git Integration**: Executes git commands to retrieve staged changes and diff information
2. **File Analysis**: Categorizes files by type (test, docs, config, source)
3. **Pattern Detection**: Analyzes file paths and diff content for keywords
4. **Message Generation**: Creates conventional commit messages based on detected patterns

## Error Handling

The tool handles common error cases:

- Not in a git repository - Shows error and exits
- No staged changes - Prompts user to stage files first
- Git command failures - Shows descriptive error messages

## Requirements

- Node.js >= 16.0.0
- Git installed and accessible from command line
- Must be run inside a git repository

## License

MIT
