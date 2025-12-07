#!/usr/bin/env bun
import { readdir, readFile, writeFile, rm, cp, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";

type SyncConfig = {
  upstream: {
    url: string;
    branch: string;
  };
  strategy: string;
  branches: {
    upstream: string;
    custom: string;
    main: string;
  };
  syncMode: "allowlist" | "blocklist";
  allowlist: string[];
  blocklist: string[];
  preserveCustomApps: boolean;
  customApps: string[];
  versionComparisonRules: {
    keepIfNewerAppVersion: boolean;
    requireComparableTipiVersion: boolean;
    tipiVersionMaxGap: number;
  };
};

type AppConfig = {
  id: string;
  version: string;
  tipi_version: number;
  updated_at: number;
};

const WORKSPACE_ROOT = process.cwd();
const CONFIG_PATH = join(WORKSPACE_ROOT, ".runtipi-sync", "config.json");
const APPS_DIR = join(WORKSPACE_ROOT, "apps");
const TEMP_DIR = join(WORKSPACE_ROOT, ".runtipi-sync", "temp");
const UPSTREAM_DIR = join(TEMP_DIR, "upstream");

class UpstreamSync {
  private config: SyncConfig;
  private changes: {
    updated: string[];
    added: string[];
    removed: string[];
    preserved: string[];
    conflicts: Array<{ app: string; reason: string }>;
  } = {
    updated: [],
    added: [],
    removed: [],
    preserved: [],
    conflicts: [],
  };

  constructor(config: SyncConfig) {
    this.config = config;
  }

  async loadConfig(): Promise<SyncConfig> {
    const configContent = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(configContent);
  }

  async runGitCommand(args: string[]): Promise<string> {
    const proc = Bun.spawn(["git", ...args], {
      cwd: WORKSPACE_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      throw new Error(`Git command failed: ${stderr}`);
    }

    return stdout.trim();
  }

  async cloneUpstream(): Promise<void> {
    console.log("🔄 Cloning upstream repository...");

    // Clean temp directory
    if (existsSync(TEMP_DIR)) {
      await rm(TEMP_DIR, { recursive: true, force: true });
    }
    await mkdir(TEMP_DIR, { recursive: true });

    // Clone upstream (shallow clone for efficiency)
    const cloneCmd = [
      "git",
      "clone",
      "--depth=1",
      `--branch=${this.config.upstream.branch}`,
      this.config.upstream.url,
      UPSTREAM_DIR,
    ];

    const proc = Bun.spawn(cloneCmd, {
      cwd: TEMP_DIR,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Failed to clone upstream: ${stderr}`);
    }

    console.log("✅ Upstream cloned successfully");
  }

  async getUpstreamApps(): Promise<string[]> {
    const upstreamAppsDir = join(UPSTREAM_DIR, "apps");
    const entries = await readdir(upstreamAppsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== ".DS_Store")
      .map((entry) => entry.name);
  }

  async getLocalApps(): Promise<string[]> {
    const entries = await readdir(APPS_DIR, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name !== ".DS_Store" &&
          !entry.name.endsWith(".common.yml")
      )
      .map((entry) => entry.name);
  }

  async readAppConfig(appPath: string): Promise<AppConfig | null> {
    try {
      const configPath = join(appPath, "config.json");
      const content = await readFile(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  shouldSyncApp(appName: string, isInUpstream: boolean): boolean {
    // In branch-based mode, sync allowlisted apps to upstream branch
    if (this.config.syncMode === "allowlist") {
      return this.config.allowlist.includes(appName);
    } else {
      return !this.config.blocklist.includes(appName);
    }
  }

  async compareVersions(
    localConfig: AppConfig,
    upstreamConfig: AppConfig
  ): Promise<{ shouldUpdate: boolean; reason: string }> {
    const rules = this.config.versionComparisonRules;

    // Compare app versions
    const localVer = localConfig.version;
    const upstreamVer = upstreamConfig.version;

    if (localVer === upstreamVer) {
      // Same app version - check tipi_version
      if (localConfig.tipi_version < upstreamConfig.tipi_version) {
        return {
          shouldUpdate: true,
          reason: `Config update: tipi_version ${localConfig.tipi_version} → ${upstreamConfig.tipi_version}`,
        };
      }
      return {
        shouldUpdate: false,
        reason: "Already up to date",
      };
    }

    // Local version is newer
    if (this.versionCompare(localVer, upstreamVer) > 0) {
      if (rules.requireComparableTipiVersion) {
        const gap =
          upstreamConfig.tipi_version - localConfig.tipi_version;
        if (gap > rules.tipiVersionMaxGap) {
          return {
            shouldUpdate: false,
            reason: `Local newer (${localVer}) but tipi_version too far behind (gap: ${gap})`,
          };
        }
      }
      return {
        shouldUpdate: false,
        reason: `Local version newer: ${localVer} > ${upstreamVer}`,
      };
    }

    // Upstream version is newer
    return {
      shouldUpdate: true,
      reason: `Version update: ${localVer} → ${upstreamVer}`,
    };
  }

  versionCompare(v1: string, v2: string): number {
    // Simple semantic version comparison
    // Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
    const parts1 = v1.split(".").map((x) => parseInt(x) || 0);
    const parts2 = v2.split(".").map((x) => parseInt(x) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  async syncApp(appName: string): Promise<void> {
    const localAppPath = join(APPS_DIR, appName);
    const upstreamAppPath = join(UPSTREAM_DIR, "apps", appName);

    const upstreamExists = existsSync(upstreamAppPath);

    // Only sync apps that are in the allowlist/blocklist
    if (!this.shouldSyncApp(appName, upstreamExists)) {
      console.log(`  ⏭️  Skipped: ${appName} (not in sync list)`);
      return;
    }

    if (!upstreamExists) {
      console.log(`  ⚠️  Warning: ${appName} in allowlist but not found in upstream`);
      this.changes.conflicts.push({
        app: appName,
        reason: "In allowlist but not found in upstream",
      });
      return;
    }

    const localExists = existsSync(localAppPath);

    // App not in local - add it
    if (!localExists) {
      await cp(upstreamAppPath, localAppPath, { recursive: true });
      this.changes.added.push(appName);
      console.log(`  ➕ Added: ${appName}`);
      return;
    }

    // Compare versions to decide whether to update
    const localConfig = await this.readAppConfig(localAppPath);
    const upstreamConfig = await this.readAppConfig(upstreamAppPath);

    if (!localConfig || !upstreamConfig) {
      this.changes.conflicts.push({
        app: appName,
        reason: "Could not read config.json",
      });
      console.log(`  ⚠️  Conflict: ${appName} - could not read config`);
      return;
    }

    const comparison = await this.compareVersions(
      localConfig,
      upstreamConfig
    );

    if (comparison.shouldUpdate) {
      await rm(localAppPath, { recursive: true, force: true });
      await cp(upstreamAppPath, localAppPath, { recursive: true });
      this.changes.updated.push(appName);
      console.log(`  🔄 Updated: ${appName} - ${comparison.reason}`);
    } else {
      this.changes.preserved.push(appName);
      console.log(`  ✅ Kept local: ${appName} - ${comparison.reason}`);
    }
  }

  async sync(): Promise<typeof this.changes> {
    console.log("🚀 Starting upstream sync (branch-based workflow)...\n");
    console.log("📝 Strategy: Sync ALL apps from upstream to upstream branch\n");

    // Ensure we're on the upstream branch
    try {
      await this.runGitCommand(["checkout", this.config.branches.upstream]);
      console.log(`✅ Switched to branch: ${this.config.branches.upstream}\n`);
    } catch (error) {
      console.log(`⚠️  Branch ${this.config.branches.upstream} doesn't exist, creating it...`);
      await this.runGitCommand(["checkout", "-b", this.config.branches.upstream]);
    }

    // Clone upstream
    await this.cloneUpstream();

    // Get ALL upstream apps (no filtering here)
    const upstreamApps = await this.getUpstreamApps();

    console.log(`\n📊 Found ${upstreamApps.length} upstream apps, syncing ALL to upstream branch\n`);

    // Remove all existing apps in the apps directory (except common files)
    const existingApps = await this.getLocalApps();
    for (const appName of existingApps) {
      const appPath = join(APPS_DIR, appName);
      await rm(appPath, { recursive: true, force: true });
      console.log(`  🧹 Removed old: ${appName}`);
    }

    // Copy ALL apps from upstream
    for (const appName of upstreamApps.sort()) {
      const upstreamAppPath = join(UPSTREAM_DIR, "apps", appName);
      const localAppPath = join(APPS_DIR, appName);
      
      await cp(upstreamAppPath, localAppPath, { recursive: true });
      this.changes.added.push(appName);
      console.log(`  ➕ Added: ${appName}`);
    }

    // Cleanup temp directory
    await rm(TEMP_DIR, { recursive: true, force: true });

    return this.changes;
  }

  printSummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📋 SYNC SUMMARY");
    console.log("=".repeat(60));

    if (this.changes.added.length > 0) {
      console.log(`\n➕ Added (${this.changes.added.length}):`);
      this.changes.added.forEach((app) => console.log(`   - ${app}`));
    }

    if (this.changes.updated.length > 0) {
      console.log(`\n🔄 Updated (${this.changes.updated.length}):`);
      this.changes.updated.forEach((app) => console.log(`   - ${app}`));
    }

    if (this.changes.removed.length > 0) {
      console.log(`\n❌ Removed (${this.changes.removed.length}):`);
      this.changes.removed.forEach((app) => console.log(`   - ${app}`));
    }

    if (this.changes.preserved.length > 0) {
      console.log(`\n🔒 Preserved (${this.changes.preserved.length}):`);
      this.changes.preserved.forEach((app) => console.log(`   - ${app}`));
    }

    if (this.changes.conflicts.length > 0) {
      console.log(`\n⚠️  Conflicts (${this.changes.conflicts.length}):`);
      this.changes.conflicts.forEach(({ app, reason }) =>
        console.log(`   - ${app}: ${reason}`)
      );
    }

    const totalChanges =
      this.changes.added.length +
      this.changes.updated.length +
      this.changes.removed.length;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Total changes: ${totalChanges}`);
    console.log("=".repeat(60) + "\n");
  }

  async generateChangelog(): Promise<string> {
    const lines: string[] = [];
    lines.push("# Upstream Sync Changes");
    lines.push("");
    lines.push(`**Date:** ${new Date().toISOString()}`);
    lines.push(`**Upstream:** ${this.config.upstream.url}`);
    lines.push(`**Branch:** ${this.config.branches.upstream}`);
    lines.push("");

    if (this.changes.added.length > 0) {
      lines.push("## ➕ Added Apps");
      this.changes.added.forEach((app) => lines.push(`- ${app}`));
      lines.push("");
    }

    if (this.changes.updated.length > 0) {
      lines.push("## 🔄 Updated Apps");
      this.changes.updated.forEach((app) => lines.push(`- ${app}`));
      lines.push("");
    }

    if (this.changes.removed.length > 0) {
      lines.push("## ❌ Removed Apps");
      this.changes.removed.forEach((app) => lines.push(`- ${app}`));
      lines.push("");
    }

    if (this.changes.conflicts.length > 0) {
      lines.push("## ⚠️ Conflicts");
      this.changes.conflicts.forEach(({ app, reason }) =>
        lines.push(`- **${app}**: ${reason}`)
      );
      lines.push("");
    }

    lines.push("---");
    lines.push(`Total changes: ${this.changes.added.length + this.changes.updated.length + this.changes.removed.length}`);

    return lines.join("\n");
  }

  async commitAndPush(): Promise<void> {
    console.log("\n📤 Committing changes to upstream branch...");

    // Check if there are changes
    const status = await this.runGitCommand(["status", "--porcelain"]);
    if (!status) {
      console.log("✅ No changes to commit");
      return;
    }

    // Add all changes
    await this.runGitCommand(["add", "apps/"]);

    // Commit
    const commitMessage = `chore: sync apps from upstream (${new Date().toISOString().split('T')[0]})`;
    await this.runGitCommand(["commit", "-m", commitMessage]);

    // Push to remote
    try {
      await this.runGitCommand(["push", "origin", this.config.branches.upstream, "--force"]);
      console.log(`✅ Pushed changes to ${this.config.branches.upstream} branch`);
    } catch (error) {
      console.log(`⚠️  Failed to push. You may need to push manually: git push origin ${this.config.branches.upstream} --force`);
    }
  }
}

// Main execution
async function main() {
  try {
    const syncer = new UpstreamSync({} as SyncConfig);
    const config = await syncer.loadConfig();
    const sync = new UpstreamSync(config);

    const changes = await sync.sync();
    sync.printSummary();

    // Write changelog
    const changelog = await sync.generateChangelog();
    const changelogPath = join(WORKSPACE_ROOT, ".runtipi-sync", "SYNC_CHANGELOG.md");
    await writeFile(changelogPath, changelog);
    console.log(`📄 Changelog written to ${changelogPath}\n`);

    // Commit and push to upstream branch
    await sync.commitAndPush();

    // Exit with code 1 if there are changes (for CI/CD detection)
    const hasChanges =
      changes.added.length + changes.updated.length + changes.removed.length > 0;
    
    if (hasChanges) {
      console.log("\n✅ Upstream branch updated successfully. Run merge workflow to integrate into main.");
    }
    
    process.exit(hasChanges ? 1 : 0);
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(2);
  }
}

main();
