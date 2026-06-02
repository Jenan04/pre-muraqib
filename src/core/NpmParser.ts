import * as fs from "node:fs";
import path from "path";
import https from "node:https";
import type { syntaxIssue } from "../types/interface.js";
import { osvConfig } from "../config/osv.config.js";
function makeOsvRequest(
  actualVersion: string,
  packageName: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      version: actualVersion,
      package: {
        name: packageName,
        ecosystem: "npm",
      },
    });

    const options = {
      ...osvConfig,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent": "Muraqib-Audit-Tool/1.0",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON response"));
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });
    req.write(postData);
    req.end();
  });
}

export async function NpmParser(fileparser: string) {
  const issues: syntaxIssue[] = [];

  const nodeModulesPath = path.join(process.cwd(), "node_modules");
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(
      "❌ node_modules folder wasn't found. plz run 'npm install' first",
    );
    return { issues };
  }

  try {
    const fileContent = fs.readFileSync(fileparser, "utf8");
    const allLines = fileContent.split("\n");

    const packageJson = JSON.parse(fileContent);
    const dependencies = packageJson.dependencies || {};

    for (const packageName of Object.keys(dependencies)) {
      let actualVersion = dependencies[packageName];
      try {
        const pathToSubPackage = path.join(
          process.cwd(),
          "node_modules",
          packageName,
          "package.json",
        );
        if (fs.existsSync(pathToSubPackage)) {
          const subPackageJson = JSON.parse(
            fs.readFileSync(pathToSubPackage, "utf8"),
          );
          actualVersion = subPackageJson.version;
        }
      } catch (e) {
        actualVersion = actualVersion.replace(/[\^~]/g, "");
      }

      try {
        const data = await makeOsvRequest(actualVersion, packageName);

        if (data.vulns && data.vulns.length > 0) {
          const foundLineIndex = allLines.findIndex((line) =>
            line.includes(`"${packageName}"`),
          );

          let safeVersion = "latest secure version";
          const firstVuln = data.vulns[0];

          if (firstVuln.affected && firstVuln.affected.length > 0) {
            const ranges = firstVuln.affected[0].ranges;

            if (ranges && ranges.length > 0) {
              const ecosystemRange = ranges.find(
                (r: any) => r.type === "ECOSYSTEM",
              );

              if (ecosystemRange && ecosystemRange.events) {
                const fixedEvent = ecosystemRange.events.find(
                  (e: any) =>
                    e.fixed &&
                    !e.fixed.includes("-beta") &&
                    !e.fixed.includes("-rc") &&
                    !e.fixed.includes("-alpha"),
                );

                if (fixedEvent && fixedEvent.fixed) {
                  safeVersion = fixedEvent.fixed;
                }
              }
            }
          }
          const realLineNum = foundLineIndex !== -1 ? foundLineIndex + 1 : 0;

          const totalVulns = data.vulns.length;

          issues.push({
            line: realLineNum,
            type: "syntax",
            severity: "error",
            // message: `Package [${packageName}@${actualVersion}] has ${totalVulns} known vulnerabilities. Fix configuration or upgrade to a secure version immediately.`,
            message: `Package [${packageName}] is using an insecure version (${actualVersion}). Found ${totalVulns} vulnerabilities. Remediation: Upgrade to version [${safeVersion}] or higher.`,
            key: packageName,
          });
        }
      } catch (error: any) {
        console.error(
          `❌ Error scanning package ${packageName}:`,
          error.message || error,
        );
      }
    }
  } catch (parseError) {
    console.error("❌ Failed to parse package.json.");
  }

  return { issues };
}
