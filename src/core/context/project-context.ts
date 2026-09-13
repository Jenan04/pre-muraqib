import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectContext {
  projectPath: string;
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
  nodeVersion: string;
  files: string[];
  envFiles: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export function createProjectContext(projectPath: string = process.cwd()): ProjectContext {
  let packageManager: ProjectContext["packageManager"] = "npm";

  if (fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (fs.existsSync(path.join(projectPath, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (fs.existsSync(path.join(projectPath, "bun.lockb"))) {
    packageManager = "bun";
  }

  let envFiles: string[] = [];
  try {
    envFiles = fs
      .readdirSync(projectPath)
      .filter((file) => file.startsWith(".env"));
  } catch {
    envFiles = [];
  }

  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  const pkgPath = path.join(projectPath, "package.json");

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      dependencies = pkg.dependencies ?? {};
      devDependencies = pkg.devDependencies ?? {};
    } catch {
      // Ignored
    }
  }

  return {
    projectPath,
    packageManager,
    nodeVersion: process.version,
    files: envFiles,
    envFiles,
    dependencies,
    devDependencies,
  };
}
