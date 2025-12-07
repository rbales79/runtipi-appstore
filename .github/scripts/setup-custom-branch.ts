#!/usr/bin/env bun
import { readdir, readFile, writeFile, rm, cp, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

type SyncConfig = {
  branches: {
    upstream: string;
    custom: string;
    main: string;
  };
  customApps: string[];
};

const WORKSPACE_ROOT = process.cwd();
const CONFIG_PATH = join(WORKSPACE_ROOT, ".runtipi-sync", "config.json");
const APPS_DIR = join(WORKSPACE_ROOT, "apps");

class CustomBranchSetup {
  private config: SyncConfig;

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

  async setupCustomBranch(): Promise<void> {
    console.log("🚀 Setting up custom branch...\n");

    // Ensure we're on main branch first
    try {
      await this.runGitCommand(["checkout", this.config.branches.main]);
      console.log(`✅ Switched to main branch\n`);
    } catch (error) {
      console.error("⚠️  Could not checkout main branch. Make sure it exists.");
      throw error;
    }

    // Create or checkout custom branch
    try {
      await this.runGitCommand(["checkout", this.config.branches.custom]);
      console.log(`✅ Switched to existing custom branch: ${this.config.branches.custom}\n`);
    } catch {
      console.log(`📝 Creating new custom branch: ${this.config.branches.custom}...`);
      await this.runGitCommand(["checkout", "-b", this.config.branches.custom]);
      console.log(`✅ Created custom branch\n`);
    }

    // Get all current apps
    const allApps = await this.getLocalApps();
    const customApps = this.config.customApps;

    console.log(`📊 Found ${allApps.length} total apps, ${customApps.length} custom apps\n`);

    // Remove non-custom apps
    const appsToRemove = allApps.filter((app) => !customApps.includes(app));
    
    for (const appName of appsToRemove) {
      const appPath = join(APPS_DIR, appName);
      await rm(appPath, { recursive: true, force: true });
      console.log(`  ❌ Removed: ${appName}`);
    }

    // Verify custom apps remain
    console.log("\n🔒 Preserved custom apps:");
    for (const appName of customApps) {
      const appPath = join(APPS_DIR, appName);
      if (existsSync(appPath)) {
        console.log(`  ✅ ${appName}`);
      } else {
        console.log(`  ⚠️  ${appName} (not found in main branch)`);
      }
    }

    console.log("\n📤 Committing changes...");

    // Check if there are changes
    const status = await this.runGitCommand(["status", "--porcelain"]);
    if (!status) {
      console.log("✅ No changes to commit (custom branch already clean)");
      return;
    }

    // Add and commit
    await this.runGitCommand(["add", "-A"]);
    const commitMessage = `chore: initialize custom branch with ${customApps.length} custom apps`;
    await this.runGitCommand(["commit", "-m", commitMessage]);

    // Push to remote
    try {
      await this.runGitCommand(["push", "origin", this.config.branches.custom, "--force"]);
      console.log(`✅ Pushed custom branch to remote`);
    } catch (error) {
      console.log(`⚠️  Failed to push. You may need to push manually: git push origin ${this.config.branches.custom} --force`);
    }

    console.log("\n✨ Custom branch setup complete!");
    console.log(`\nCustom apps (${customApps.length}):`);
    customApps.forEach((app) => console.log(`  - ${app}`));
  }
}

// Main execution
async function main() {
  try {
    const setup = new CustomBranchSetup({} as SyncConfig);
    const config = await setup.loadConfig();
    const setupInstance = new CustomBranchSetup(config);

    await setupInstance.setupCustomBranch();

    process.exit(0);
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

main();
