import * as fs from "node:fs";
import * as path from "node:path";

export interface DockerDiscoveryResult {
  dockerfiles: string[];
  composeFiles: string[];
  dockerignoreFiles: string[];
}

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "vendor",
  "build",
  "out",
  ".next",
  "coverage"
]);

export function discoverDockerFiles(projectRoot: string): DockerDiscoveryResult {
  const dockerfiles: string[] = [];
  const composeFiles: string[] = [];
  const dockerignoreFiles: string[] = [];
  
  const rootAbsolute = path.resolve(projectRoot);
  const visited = new Set<string>();

  function walk(dir: string, depth: number = 0) {
    if (depth > 10) return; // Bound traversal
    
    let resolvedDir: string;
    try {
      resolvedDir = fs.realpathSync(dir);
    } catch {
      return;
    }
    
    if (visited.has(resolvedDir)) return;
    visited.add(resolvedDir);
    
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();

      // Prevent symlink escape
      if (entry.isSymbolicLink()) {
        try {
          const realPath = fs.realpathSync(fullPath);
          if (!realPath.startsWith(rootAbsolute)) {
            continue;
          }
          const stat = fs.statSync(realPath);
          isDir = stat.isDirectory();
          isFile = stat.isFile();
        } catch {
          continue;
        }
      }

      if (isDir) {
        walk(fullPath, depth + 1);
      } else if (isFile) {
        const lowerName = entry.name.toLowerCase();
        // Dockerfile discovery
        if (lowerName === "dockerfile" || lowerName.startsWith("dockerfile.")) {
          dockerfiles.push(path.relative(rootAbsolute, fullPath));
        }
        
        if (lowerName === ".dockerignore") {
          dockerignoreFiles.push(path.relative(rootAbsolute, fullPath));
        }
        
        // Compose file discovery
        if (lowerName === "compose.yaml" || lowerName === "compose.yml" || lowerName === "docker-compose.yml" || lowerName === "docker-compose.yaml" || lowerName.startsWith("docker-compose.override.")) {
          composeFiles.push(path.relative(rootAbsolute, fullPath));
        }
      }
    }
  }

  walk(rootAbsolute);
  
  return {
    dockerfiles: dockerfiles.sort(),
    composeFiles: composeFiles.sort(),
    dockerignoreFiles: dockerignoreFiles.sort(),
  };
}
