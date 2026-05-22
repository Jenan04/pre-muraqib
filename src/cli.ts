import * as x from "@clack/prompts"; // import * => select(), intro(), outro(), spinner(), confirm(), note(), isCancel()
import { styleText } from "node:util";

async function main() {
  console.clear();

  x.intro(`${styleText(["bgCyan", "black"], 'Muraqib 🛡️ ')} ${styleText("dim", "◈ DevSecOps Config Auditor")}`);

  const mode = await x.select({
    message: "Select the tracking & monitoring environment:",
    options: [
      {
        value: "build",
        label: "Build Mode",
        hint: "Fast local checks for syntax errors & duplicate keys",
      },
      {
        value: "prod",
        label: "Production Mode",
        hint: "Strict security auditing for leaked tokens & weak secrets",
      },
    ],
  });

  if (x.isCancel(mode)) {
    x.cancel('Scan cancelled by user.');
    process.exit(0);
  }

// fake spinner for now 
  const s = x.spinner();
  s.start('Analyzing configuration files...');
  
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  s.stop('Analysis complete!');

  x.note(
    `• Target Environment: ${styleText('cyan', String(mode))}\n• Status: ${styleText('green', 'Ready to implement scanning logic.')}`,
    'Audit Summary (Playground)'
  );

  x.outro(styleText("dim", "Stay secure! ✨"));
}

main().catch((err) => {
  console.error("An error occurred:", err);
  process.exit(1);
});
