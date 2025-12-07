# Runtipi Appstore - AI Agent Instructions

## Project Overview

This is a **curated Runtipi appstore** containing 26 self-hosted applications from multiple community sources. 

**Key Strategy**: We maintain a three-branch repository:
1. **`upstream` branch**: Contains only apps synced from official Runtipi appstore (currently only n8n)
2. **`custom` branch**: Contains 25 custom apps not available in the official repo
3. **`main` branch**: Merged result of upstream + custom branches, validated and tested

**Automated Workflow**: GitHub Actions automatically syncs upstream apps weekly and creates PRs to merge both branches into main.

**Repository Purpose**: Provide a curated collection of unique apps plus selectively updated apps from upstream, all maintained automatically through branch-based workflow.

## Upstream Sync Architecture

### Branch-Based Strategy

The repository uses three branches to maintain separation between upstream and custom apps:

**Branch Structure:**
- **`upstream` branch**: Automatically synced apps from official Runtipi appstore
  - Only contains apps listed in `.runtipi-sync/config.json` allowlist
  - Completely replaced on each sync (no custom modifications preserved here)
  - Updated weekly via GitHub Actions
  
- **`custom` branch**: Manually maintained custom apps
  - Contains all 25 custom apps listed in `customApps` array
  - Never touched by upstream sync automation
  - Updated manually when custom apps need changes
  
- **`main` branch**: Production branch
  - Merge of upstream + custom branches
  - Validated with schema tests before merge
  - Updated via PR after upstream sync completes

**Sync Modes:**
- **Allowlist mode** (current): Only sync apps explicitly listed in `allowlist`
- **Blocklist mode**: Sync all upstream apps except those in `blocklist`

### Configuration Structure

Located at `.runtipi-sync/config.json`:

```json
{
  "upstream": {
    "url": "https://github.com/runtipi/runtipi-appstore.git",
    "branch": "master"
  },
  "strategy": "branch-based",
  "branches": {
    "upstream": "upstream",
    "custom": "custom",
    "main": "main"
  },
  "syncMode": "allowlist",
  "allowlist": ["n8n"],  // Only sync n8n from upstream
  "customApps": [/* 25 custom apps */],
  "versionComparisonRules": {
    "keepIfNewerAppVersion": true,
    "requireComparableTipiVersion": true,
    "tipiVersionMaxGap": 20
  }
}
```

### Sync Workflow

**Automatic Schedule**: Every Monday at 2:00 AM UTC
**Manual Trigger**: Via GitHub Actions UI with optional dry-run mode

**Process:**
1. **Upstream Sync Workflow** (`upstream-sync.yml`)
   - Checkout upstream branch
   - Clone official Runtipi appstore
   - Clear upstream branch apps directory
   - Copy allowlisted apps from official repo
   - Compare versions and update if newer
   - Commit and push to upstream branch
   - Generate changelog

2. **Merge Workflow** (`merge-branches.yml`)
   - Triggered automatically after upstream sync succeeds
   - Create temporary merge branch from main
   - Merge upstream branch (only synced apps)
   - Merge custom branch (only custom apps)
   - Run schema validation tests
   - Create PR to main if changes detected
   - Include app counts and test results in PR

**Script Locations:**
- `.github/scripts/sync-upstream.ts` - Syncs upstream apps to upstream branch
- `.github/scripts/setup-custom-branch.ts` - Initializes custom branch with only custom apps
- `.github/workflows/upstream-sync.yml` - Weekly upstream sync automation
- `.github/workflows/merge-branches.yml` - Merges branches to main with validation

### Version Comparison Logic

When syncing allowlisted apps:
- Compare `version` (upstream app version) semantically
- Check `tipi_version` gap doesn't exceed threshold (20)
- Keep local version if newer AND config is current
- Update from upstream if upstream is newer
- Flag conflicts if configs can't be compared

Example: Local n8n 1.125.0 vs upstream 1.123.0 → Keep local (newer)
Example: Local n8n 1.120.0 vs upstream 1.123.0 → Update from upstream

## Architecture

### App Structure (Critical Pattern)
Every app in `apps/<app-name>/` MUST have exactly 4 files:

```
apps/<app-name>/
├── config.json              # App metadata (schema: @runtipi/common/schemas)
├── docker-compose.json      # Dynamic compose config (Runtipi-specific format)
├── metadata/
│   ├── logo.jpg            # App logo
│   └── description.md      # Markdown description
```

### Key Files Explained

**`config.json`** - Runtipi app manifest:
- `version`: Upstream app version (e.g., "1.123.3")
- `tipi_version`: Package config iteration (increments with each update)
- `updated_at`: Unix timestamp in milliseconds
- `form_fields`: Dynamic user inputs (type: "random" generates secrets)
- Must validate against `appInfoSchema` from `@runtipi/common/schemas`

**`docker-compose.json`** - NOT standard Docker Compose:
- Runtipi's dynamic format (uses `services` array, not object)
- Environment variables use `${VAR}` syntax
- `isMain: true` marks the primary service
- Must validate against `dynamicComposeSchema`

### Version Management Strategy

**Critical**: When comparing with official Runtipi appstore:
1. If official has same or newer app version → **Remove our app** (avoid duplication)
2. If we have newer app version BUT older `tipi_version` → **Still remove** (config outdated)
3. Only keep if: newer app version AND comparable/newer `tipi_version`

See `COMPARISON.md` for rationale on which apps we keep vs remove.

## Development Workflows

### Initial Setup of Branch Structure

To set up the three-branch structure for the first time:

```bash
# 1. Setup custom branch (removes non-custom apps)
bun .github/scripts/setup-custom-branch.ts

# 2. Manually create and push upstream branch (or wait for first sync)
git checkout -b upstream
# Run first sync
bun .github/scripts/sync-upstream.ts
git push origin upstream

# 3. Return to main
git checkout main
```

### Testing
```bash
bun install
bun test          # Validates all apps against schemas
```

Tests verify (`__tests__/apps.test.ts`):
- Required files exist
- `config.json` matches `appInfoSchema` 
- `docker-compose.json` matches `dynamicComposeSchema`

### Adding a New App

**For Custom Apps (not in official appstore):**
1. Ensure you're on the `custom` branch: `git checkout custom`
2. Create `apps/<app-name>/` with all 4 required files
3. Set `tipi_version: 1` for new apps
4. Add app name to `.runtipi-sync/config.json` → `customApps` array
5. Run `bun test` to validate schemas
6. Commit and push to `custom` branch
7. Manually trigger merge workflow or wait for next upstream sync

**For Synced Apps (from official appstore):**
1. Add app name to `.runtipi-sync/config.json` → `allowlist` array (on `main` branch)
2. Manually trigger upstream sync workflow OR wait for next Monday
3. Review and merge the auto-generated PR

### Updating an App Version
```bash
bun .github/scripts/update-config.ts apps/<app>/config.json <new-version>
```
This script automatically:
- Updates `version` field
- Increments `tipi_version`
- Sets `updated_at` to current timestamp

**Manual alternative**: Edit `config.json` directly, but remember to update all 3 fields.

### Renovate Bot Integration
Renovate automatically:
- Detects Docker image updates in `docker-compose.json` via regex: `"image": "(?<depName>.*?):(?<currentValue>.*?)"`
- Runs `update-config.ts` post-upgrade to sync `config.json`
- Automerges minor/patch updates and devDependencies
- Works for BOTH synced and custom apps (all apps have Renovate enabled)
- Creates PRs against appropriate branch (custom branch for custom apps, main for config changes)

### Upstream Sync Workflow
To manually trigger upstream sync:
```bash
# Dry run (see what would change without pushing)
gh workflow run upstream-sync.yml -f dry_run=true

# Actual sync (pushes to upstream branch, triggers merge workflow)
gh workflow run upstream-sync.yml
```

To test sync locally:
```bash
# Must be on upstream branch
git checkout upstream
bun .github/scripts/sync-upstream.ts
# Review changes in .runtipi-sync/SYNC_CHANGELOG.md
```

**Automated**: Runs every Monday at 2 AM UTC, pushes to upstream branch, then triggers merge workflow that creates PR to main.

## Project Conventions

### Version Comparison Protocol
When evaluating apps:
- **Synced apps** (in allowlist): Compare with upstream weekly, update if upstream newer
- **Custom apps**: Never compared with upstream, maintained independently
- **App version**: Semantic version of the upstream application
- **tipi_version**: Config/package iteration (Runtipi-specific)
- **Version rules**: See `.runtipi-sync/config.json` → `versionComparisonRules`

Example: n8n is synced - if upstream releases 1.125.0 and we have 1.123.3, sync workflow will update it.

### Branch Workflow
- **`upstream` branch**: Only contains allowlisted apps from official appstore (auto-maintained)
- **`custom` branch**: Only contains custom apps (manually maintained)
- **`main` branch**: Merge of both branches (auto-maintained via PRs)
- Never commit directly to `upstream` branch - it's completely replaced on each sync
- Update custom apps on `custom` branch, then merge to main via workflow
- All PRs from workflows should be reviewed before merging to main

### Documentation Standards
- `COMPARISON.md`: Historical comparison with official appstore (preserved for context)
- `VERSION_COMPARISON.md`: Detailed version analysis (preserved for reference)
- `.runtipi-sync/config.json`: Active sync configuration - **THE source of truth**
- `.runtipi-sync/SYNC_CHANGELOG.md`: Generated after each sync with change summary
- Always update README.md app count when adding/removing apps

### File Naming
- App IDs must match directory name: `apps/n8n/` → `"id": "n8n"` in config.json
- Use lowercase with hyphens: `gitea-runner`, not `GiteaRunner`

## Key Dependencies

- **Bun**: Runtime for tests and scripts
- **@runtipi/common**: Provides `appInfoSchema` and `dynamicComposeSchema` validators
- **zod-validation-error**: Friendly error messages for schema violations

## Integration Points

### Runtipi Platform
Apps integrate via:
- `${APP_DATA_DIR}`: Persistent storage path injected by Runtipi
- Port configuration in `config.json` (must be unique across appstore)
- `exposable: true`: App can be exposed via reverse proxy
- `form_fields`: Dynamic configuration UI in Runtipi dashboard

### External Dependencies
None. Apps are self-contained with their Docker images and configs.

## Common Pitfalls

1. **Don't use standard docker-compose.yml format** - Runtipi uses `docker-compose.json` with different schema
2. **Always increment tipi_version** when updating app configs (not just app version)
3. **Update `.runtipi-sync/config.json` when adding apps** - add to `customApps` or `allowlist`
4. **Don't manually update synced apps** - they'll be overwritten on next sync (update upstream instead)
5. **Don't commit to upstream branch** - it's automatically maintained and force-pushed
6. **Work on correct branch** - custom apps go on `custom` branch, not `main`
7. **Random form fields must not be required** - type "random" generates values automatically
8. **Timestamps are in milliseconds** - use `Date.now()` not `Date.now() / 1000`

## Example: Adding an App from Scratch

```json
// apps/myapp/config.json
{
  "name": "My App",
  "id": "myapp",
  "version": "1.0.0",
  "tipi_version": 1,
  "port": 8999,  // Check no conflicts
  "available": true,
  "supported_architectures": ["arm64", "amd64"],
  "created_at": 1733612345678,  // Date.now()
  "updated_at": 1733612345678,
  "exposable": true,
  "dynamic_config": true,
  "categories": ["automation"],
  "short_desc": "Brief description",
  "description": "Longer description",
  "author": "upstream-author",
  "source": "https://github.com/author/myapp",
  "form_fields": [],
  "$schema": "https://schemas.runtipi.io/app-info.json"
}
```

Then create `docker-compose.json`, `metadata/logo.jpg`, and `metadata/description.md`.
