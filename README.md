# CommitGenie

A CLI tool that generates intelligent Git commit messages by analyzing your staged code changes using rule-based analysis.

## Features

- Analyzes staged Git changes automatically
- Follows [Conventional Commits](https://www.conventionalcommits.org/) format
- Adds relevant emojis to commit messages based on type
- Detects commit types based on file patterns and diff content:
  - `✨ feat:` for new features
  - `🐛 fix:` for bug fixes
  - `📚 docs:` for documentation changes
  - `🧪 test:` for test files
  - `🔧 chore:` for configuration changes
  - `♻️ refactor:` for code refactoring
  - `⚡ perf:` for performance improvements
  - `💄 style:` for style changes
- Automatically determines scope when applicable
- **Multiple message suggestions** - Choose from different commit message styles
- **Commit body support** - Automatically generates detailed body for large changes
- **Ticket/Issue linking** - Auto-detects ticket references from branch names (JIRA, GitHub issues)
- **Commit history learning** - Learns your project's commit style from past commits
- **Breaking change detection** - Automatically detects and flags breaking changes with `!` and footer
- **Dry run mode** - Preview commits without executing with `-d` or `--dry-run`
- **Custom templates** - Define your own commit message format via config
- **Commit statistics** - Analyze your repository's commit patterns with `commit-genie stats`
- **AI-powered descriptions** - Optional LLM integration for smarter commit messages with `--ai`
- Shows detailed file change statistics
- Error handling for edge cases

## Installation

### Using npx (Recommended)
Run directly without installation:
```bash
npx @m3hti/commit-genie
```

### Global Installation
```bash
npm install -g @m3hti/commit-genie
```

### Local Development
1. Clone the repository:
```bash
git clone https://github.com/M3hTi/CommitGenie.git
cd CommitGenie
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Link the CLI globally (optional):
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
# Using npx:
npx @m3hti/commit-genie

# Or if installed globally:
commit-genie

# Or for local development:
npm run dev
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

✨ feat: add userService.ts and update 1 file

──────────────────────────────────────────────────

Breakdown:
  Type: feat
  Description: add userService.ts and update 1 file

To commit with this message, run:
  git commit -m "✨ feat: add userService.ts and update 1 file"
```

### Commands

- `commit-genie` or `commit-genie generate` - Analyze changes and suggest commit message
- `commit-genie gen` - Shorthand for generate
- `commit-genie -c` or `--commit` - Auto-commit with the generated message
- `commit-genie -d` or `--dry-run` - Preview commit without executing (dry run mode)
- `commit-genie --ai` - Use AI to generate enhanced commit descriptions
- `commit-genie -s` or `--single` - Show only one suggestion (skip multiple options)
- `commit-genie -m` or `--message-only` - Output only the commit message (for scripts/hooks)
- `commit-genie --no-interactive` - Disable interactive prompts
- `commit-genie stats` - Show commit statistics for the repository
- `commit-genie stats -n 200` - Analyze last 200 commits
- `commit-genie stats --json` - Output statistics as JSON
- `commit-genie hook install` - Install git prepare-commit-msg hook
- `commit-genie hook uninstall` - Remove the git hook
- `commit-genie hook status` - Check if hook is installed
- `commit-genie config init` - Create a default config file
- `commit-genie config show` - Show current configuration
- `commit-genie --help` - Show help
- `commit-genie --version` - Show version

### Dry Run Mode

Preview exactly what would be committed without making any changes:

```bash
commit-genie -d
# or
commit-genie --dry-run
```

This displays:
- All files that would be committed (with status)
- The generated commit message
- Message breakdown (type, scope, description)
- Alternative suggestions available
- The exact git command that would be executed

Example output:
```
════════════════════════════════════════════════════════════
  DRY RUN - No changes will be made
════════════════════════════════════════════════════════════

📁 Files to be committed:
────────────────────────────────────
  + src/newFeature.ts (added)
  ~ src/utils/helper.ts (modified)

  Total: 2 file(s), +45/-3 lines

📝 Commit message:
────────────────────────────────────
  ✨ feat: add newFeature.ts and update helper

🔍 Breakdown:
────────────────────────────────────
  Type:        feat
  Description: add newFeature.ts and update helper

⚡ Command that would be executed:
────────────────────────────────────
  git commit -m "✨ feat: add newFeature.ts and update helper"

════════════════════════════════════════════════════════════
  To commit, run: commit-genie -c
  Or interactively: commit-genie
════════════════════════════════════════════════════════════
```

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
  "includeEmoji": true,
  "maxMessageLength": 72,
  "ticketLinking": {
    "enabled": true,
    "patterns": ["[A-Z]{2,10}-\\d+", "#\\d+"],
    "prefix": "Refs:"
  },
  "learnFromHistory": {
    "enabled": true,
    "commitCount": 50
  },
  "breakingChangeDetection": {
    "enabled": true,
    "keywords": ["breaking", "removed", "deleted", "deprecated"],
    "includeFooter": true
  }
}
```

Configuration options:
- `scopes` - Map file path patterns to commit scopes
- `defaultType` - Default commit type when none is detected
- `includeEmoji` - Include emoji prefix in commit messages (default: learned from history)
- `maxMessageLength` - Maximum length for commit messages
- `ticketLinking` - Auto-detect ticket references from branch names
  - `enabled` - Enable/disable ticket linking (default: `true`)
  - `patterns` - Custom regex patterns for ticket detection
  - `prefix` - Footer prefix like "Refs:", "Closes:", "Fixes:" (default: `"Refs:"`)
- `learnFromHistory` - Learn commit style from past commits
  - `enabled` - Enable/disable history learning (default: `true`)
  - `commitCount` - Number of commits to analyze (default: `50`)
- `breakingChangeDetection` - Detect and flag breaking changes
  - `enabled` - Enable/disable breaking change detection (default: `true`)
  - `keywords` - Custom keywords to detect breaking changes
  - `includeFooter` - Include `BREAKING CHANGE:` footer (default: `true`)

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
│   │   ├── historyService.ts       # Ticket detection & history learning
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
4. **History Learning**: Analyzes past commits to learn your project's style (emoji usage, common scopes)
5. **Ticket Detection**: Extracts ticket references from branch names (e.g., `feature/ABC-123-add-login`)
6. **Message Generation**: Creates conventional commit messages based on detected patterns

### Ticket Linking

CommitGenie automatically detects ticket references from your branch name and appends them to commit messages:

- **JIRA-style**: `ABC-123`, `PROJ-1234`
- **GitHub/GitLab issues**: `#123`, `#456`
- **Underscore style**: `ABC_123`

Example: If you're on branch `feature/ABC-123-add-login`, the commit message will include:
```
✨ feat: add login functionality

Refs: ABC-123
```

### History Learning

CommitGenie learns from your project's commit history to match its style:

- **Emoji detection**: If 30%+ of past commits use emojis, new commits will include them
- **Scope suggestions**: Learns common scopes from history to suggest for your files
- **Style matching**: Adapts to your team's conventions automatically

### Breaking Change Detection

CommitGenie automatically detects breaking changes and formats commit messages according to Conventional Commits specification:

**Detection methods:**
- **Keywords in diff**: Detects words like `breaking`, `removed`, `deleted`, `deprecated`
- **Deleted source files**: Flags removal of `.ts`, `.js`, `.py`, etc. as potentially breaking
- **Code patterns**: Identifies removed exports, deleted functions, and changed interfaces

**Output format:**
When a breaking change is detected, the commit message includes:
1. A `!` suffix on the commit type (e.g., `feat!:` instead of `feat:`)
2. A `BREAKING CHANGE:` footer explaining the change

Example output:
```
✨ feat!: remove legacy authentication endpoint

BREAKING CHANGE: Removed deprecated /auth/v1 endpoint
```

**Customization:**
- Disable detection entirely with `breakingChangeDetection.enabled: false`
- Add custom keywords with `breakingChangeDetection.keywords`
- Toggle the footer with `breakingChangeDetection.includeFooter`

### Custom Templates

Define your own commit message format using placeholders:

```json
{
  "templates": {
    "default": "{emoji} {type}({scope}): {description}",
    "noScope": "{emoji} {type}: {description}",
    "withBody": "{emoji} {type}({scope}): {description}\n\n{body}"
  }
}
```

**Available placeholders:**
- `{emoji}` - The commit type emoji (e.g., ✨, 🐛)
- `{type}` - The commit type with breaking indicator (e.g., `feat`, `feat!`)
- `{scope}` - The scope if detected
- `{description}` - The commit description

### Commit Statistics

Analyze your repository's commit patterns:

```bash
commit-genie stats
```

This shows:
- Total commits and average message length
- Conventional commits and emoji usage percentages
- Commits breakdown by type, scope, and author
- Top contributors with medals
- Recent 7-day activity chart
- Monthly commit trends

Options:
- `-n, --count <number>` - Number of commits to analyze (default: 100)
- `--json` - Output as JSON for programmatic use

### AI-Powered Descriptions

Get smarter commit messages using AI (optional):

```bash
commit-genie --ai
```

**Setup:**
1. Add your API key to config:
```json
{
  "ai": {
    "enabled": true,
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o-mini"
  }
}
```

2. Supported providers:
   - **OpenAI**: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
   - **Anthropic**: `claude-3-haiku-20240307`, `claude-3-sonnet-20240229`

The AI analyzes your diff and generates contextually aware descriptions while following Conventional Commits format.

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
