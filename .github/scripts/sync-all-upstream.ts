#!/usr/bin/env bun
import { cp, rm, mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const WORKSPACE_ROOT = process.cwd();
const APPS_DIR = join(WORKSPACE_ROOT, "apps");
const TEMP_DIR = join(WORKSPACE_ROOT, ".runtipi-sync", "temp");
const UPSTREAM_DIR = join(TEMP_DIR, "upstream");

async function main() {
  console.log("🚀 Syncing ALL apps from upstream Runtipi appstore...\n");

  // Clean temp directory
  if (existsSync(TEMP_DIR)) {
    await rm(TEMP_DIR, { recursive: true, force: true });
  }
  await mkdir(TEMP_DIR, { recursive: true });

  // Clone upstream
  console.log("🔄 Cloning upstream repository...");
  const proc = Bun.spawn(
    ["git", "clone", "--depth=1", "--branch=master", 
     "https://github.com/runtipi/runtipi-appstore.git", UPSTREAM_DIR],
    { cwd: TEMP_DIR, stdout: "pipe", stderr: "pipe" }
  );
  
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to clone: ${stderr}`);
  }
  console.log("✅ Upstream cloned\n");

  // Get all apps
  const entries = await readdir(join(UPSTREAM_DIR, "apps"), { withFileTypes: true });
  const upstreamApps = entries
    .filter((e: any) => e.isDirectory() && e.name !== ".DS_Store")
    .map((e: any) => e.name);

  console.log(`📊 Found ${upstreamApps.length} upstream apps\n`);

  // Remove all existing apps
  const existing = await readdir(APPS_DIR, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name !== ".DS_Store") {
      await rm(join(APPS_DIR, entry.name), { recursive: true, force: true });
      console.log(`  🧹 Removed: ${entry.name}`);
    }
  }

  console.log("");

  // Copy ALL apps
  for (const appName of upstreamApps.sort()) {
    const src = join(UPSTREAM_DIR, "apps", appName);
    const dest = join(APPS_DIR, appName);
    await cp(src, dest, { recursive: true });
    console.log(`  ➕ Added: ${appName}`);
  }

  // Cleanup
  await rm(TEMP_DIR, { recursive: true, force: true });

  console.log(`\n✅ Synced ${upstreamApps.length} apps to upstream branch`);
}

main().catch(console.error);
