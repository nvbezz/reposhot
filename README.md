# reposhot

CLI that packs a local repository into a single XML file for AI consumption.

## Why reposhot?

- **Zero bloat** — only 2 production dependencies (`minimatch`, `tiktoken`)
- **Real token counting** — uses tiktoken `cl100k_base`, same encoder as GPT-4
- **Deterministic output** — files sorted alphabetically, reproducible snapshots
- **Respects your ignore rules** — reads `.gitignore` and `.reposhotignore` out of the box

## Requirements

- Node.js 18+

## Install

```bash
npm install -g reposhot
```

## Usage

```bash
npx reposhot                        # pack current directory
npx reposhot -o snapshot.xml        # custom output path
npx reposhot -i "src/**"            # include only matching files
npx reposhot --ignore "**/*.test*"  # additional ignore patterns
npx reposhot --no-gitignore         # skip .gitignore rules
npx reposhot --line-numbers         # add line numbers
npx reposhot --remove-comments      # strip comments
npx reposhot --output -             # output to stdout
```

## Output format

```xml
This is a snapshot of the repository, packed into a single XML document by
reposhot for AI consumption.

<file_summary>
  <statistics>
    <repository>my-app</repository>
    <total_files>24</total_files>
    <total_tokens>18400</total_tokens>
  </statistics>
</file_summary>

<directory_structure>
src/index.ts
src/utils.ts
package.json
</directory_structure>

<files>
<file path="src/index.ts">
// file content here
</file>
</files>
```

## Config file

Create `reposhot.config.json` at the root of your project:

```json
{
  "output": "snapshot.xml",
  "include": ["src/**"],
  "ignore": ["**/*.test.ts"],
  "respectGitignore": true,
  "showLineNumbers": false,
  "removeComments": false
}
```

Priority: `CLI flags > reposhot.config.json > defaults`
