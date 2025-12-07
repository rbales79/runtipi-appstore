#!/usr/bin/env bun
import { readdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

type SyncConfig = {
  branches: {
    upstream: string;
    custom: string;
    main: string;
  };
  syncMode: "allowlist" | "blocklist";
  allowlist: string[];
  blocklist: string[];
  customApps: string[];
};

const WORKSPACE_ROOT = process.cwd();
const CONFIG_PATH = join(WORKSPACE_ROOT, ".runtipi-sync", "config.json");
const APPS_DIR = join(WORKSPACE_ROOT, "apps");

async function loadConfig(): Promise<SyncConfig> {
  const configContent = await readFile(CONFIG_PATH, "utf-8");
  return JSON.parse(configContent);
}

async function getLocalApps(): Promise<string[]> {
  const entries = await readdir(APPS_DIR, { withFileTypes: true });
  return entries
    .filter(
      (entry: any) =>
        entry.isDirectory() &&
        entry.name !== ".DS_Store" &&
        !entry.name.endsWith(".common.yml")
    )
    .map((entry: any) => entry.name);
}

function shouldIncludeApp(appName: string, config: SyncConfig): boolean {
  // Custom apps are always included
  if (config.customApps.includes(appName)) {
    return true;
  }

  // For upstream apps, apply allowlist/blocklist
  if (config.syncMode === "allowlist") {
    return config.allowlist.includes(appName);
  } else {
    return !config.blocklist.includes(appName);
  }
}

async function filterApps(): Promise<void> {
  console.log("🔍 Filtering apps based on allowlist/blocklist...\n");

  const config = await loadConfig();
  const allApps = await getLocalApps();

  console.log(`📊 Found ${allApps.length} total apps`);
  console.log(`   Custom apps: ${config.customApps.length}`);
  console.log(`   Allowlist: ${config.allowlist.length} apps\n`);

  const appsToRemove: string[] = [];
  const appsToKeep: string[] = [];

  for (const appName of allApps) {
    if (shouldIncludeApp(appName, config)) {
      appsToKeep.push(appName);
      const source = config.customApps.includes(appName) ? "custom" : "upstream";
      console.log(`  ✅ Keep: ${appName} (${source})`);
    } else {
      appsToRemove.push(appName);
      console.log(`  ❌ Remove: ${appName} (not in allowlist)`);
    }
  }

  // Remove apps not in allowlist
  for (const appName of appsToRemove) {
    const appPath = join(APPS_DIR, appName);
    await rm(appPath, { recursive: true, force: true });
  }

  console.log(`\n📋 Summary:`);
  console.log(`   Kept: ${appsToKeep.length} apps`);
  console.log(`   Removed: ${appsToRemove.length} apps`);
  console.log(`   Total in main: ${appsToKeep.length} apps`);
}

// Main execution
async function main() {
  try {
    await filterApps();
    process.exit(0);
  } catch (error) {
    console.error("❌ Filter failed:", error);
    process.exit(1);
  }
}

main();
