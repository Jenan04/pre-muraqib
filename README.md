# Muraqib — Research & Learning Playground

This repository serves as an experimental laboratory and research playground for diving deep into the architecture of modern CLI tools and DevSecOps principles.

The hands-on experiments in this repository are designed to build a solid foundational understanding for my upcoming graduation project: **Muraqib (مراقب)**—an intelligent DevSecOps tool for configuration-file vulnerability monitoring, dependency auditing, and linting.

> **Project status:** This repository is an R&D prototype and does not represent the final production codebase. A clean audit means that no blocking finding was detected by the checks that completed; it is not a guarantee that a project is fully secure.

---

## Learning & Engineering Objectives

- **Deconstructing Production Ecosystems:** Studying the public source code and architecture of established open-source libraries such as `dotenv` and `@clack/prompts` to understand clean-code practices and reusable design patterns.

- **Designing Modern Terminal UX:** Experimenting with interactive prompts, terminal rendering, stream handling, and keyboard events to create responsive and minimal CLI workflows.

- **Developing the Linter Engine Core:** Building type-safe parsing and validation pipelines to detect syntax problems, duplicate keys, weak secrets, and configuration mistakes.

- **Architecting for DevSecOps:** Exploring the differences between interactive terminal environments and non-interactive CI/CD pipelines.

- **Building Trustworthy Automation:** Ensuring that incomplete scans, unavailable services, and failed verification steps are reported honestly instead of being presented as successful security checks.

---

## Current Prototype

The current Muraqib prototype can:

- Parse and validate environment configuration files.
- Detect malformed assignments and duplicate environment keys.
- Redact environment values from findings and machine-readable reports.
- Validate configuration using custom, Zod, Valibot, or ArkType engines.
- Query OSV for known vulnerabilities affecting direct npm dependencies.
- Report partial or unavailable dependency scans.
- Detect a limited set of ecosystem compatibility problems.
- Generate optional AI-assisted explanations.
- Build and apply dependency-resolution candidates after explicit approval.
- Roll back `package.json` and the active lockfile when installation or verification fails.
- Produce interactive terminal output or JSON for CI consumers.

---

## Requirements

- Node.js 20.12 or newer
- pnpm 10.29.2 for repository development

---

## Development

Install the dependencies:

```bash
pnpm install --frozen-lockfile
```

Run the verification commands:

```bash
pnpm typecheck
pnpm test:typecheck
pnpm test
pnpm build
```

Display the CLI help:

```bash
node bin/muraqib.js --help
```

---

## CLI Usage

Run Muraqib from the project you want to inspect:

```bash
muraqib audit -e build
muraqib audit -e prod
muraqib audit --json -e build
muraqib audit --ai -e prod
muraqib resolve
```

### Options

- `-e, --env <build|prod>` selects the audit policy.
  - `build` blocks high and critical findings.
  - `prod` also blocks medium findings.
- `--engine <custom|zod|valibot|arktype>` selects the environment validation engine.
- `--json` produces machine-readable output and disables interactive UI.
- `--ai` explicitly enables optional AI advisory output.
- `-h, --help` displays usage information.

AI advisory output is disabled by default and is not treated as a source of truth for vulnerabilities, package versions, severity, or compatibility.

---

## Dependency Resolution

The `resolve` command presents evidence-based resolution candidates.

Before applying a candidate, Muraqib:

1. Requires explicit user approval.
2. Checks that the project manifest and lockfile have not changed.
3. Rejects unsupported complex dependency declarations.
4. Runs the project package manager.
5. Executes type checking and tests when available.
6. Re-runs security and compatibility checks.
7. Restores `package.json` and the lockfile if installation or verification fails.

A proposed version is a candidate, not a guarantee that the update is safe or compatible.

---

## Exit Codes

- `0`: No blocking findings were detected by the checks that completed.
- `1`: One or more blocking findings were detected.
- `3`: The audit could not complete reliably.

---

## Security and Privacy Boundaries

- Muraqib runs locally unless a network-backed scanner or `--ai` is used.
- Raw environment values are not included in findings or JSON evidence.
- AI receives redacted information and is advisory only.
- Partial OSV scans are reported as partial instead of clean.
- Real `.env` files must never be committed.
- Only exact, caret, and tilde semantic-version declarations are supported for automated dependency updates.

Copy `.env.example` locally when configuring the development environment:

```bash
cp .env.example .env
```

Never place real credentials inside `.env.example`.

---

## Current Limitations

- Dependency auditing currently focuses on direct npm dependencies.
- Transitive dependency and lockfile-native analysis are not yet complete.
- Compatibility checks use a deliberately limited set of rules.
- Muraqib does not currently generate SBOM or SARIF reports.
- AI explanations may be inaccurate and must not replace deterministic scanners.
- Rollback restores package metadata and the lockfile, but the installed `node_modules` tree may require a clean reinstall.
- The project is not yet intended to serve as a complete production security platform.

---

## Research Disclaimer

This repository is strictly an R&D sandbox for exploring architectural concepts, structural design patterns, security boundaries, and engineering workflows.

The implementation is expected to evolve as the graduation project requirements, threat model, and supported ecosystems become clearer.

---

## Contributing

Every change should keep the following commands passing:

```bash
pnpm typecheck
pnpm test:typecheck
pnpm test
pnpm build
npm pack --dry-run
```

Use focused Conventional Commit messages such as:

- `feat:`
- `fix:`
- `test:`
- `docs:`
- `refactor:`
- `chore:`
- `ci:`

---

## License

This project is licensed under the ISC License. See [LICENSE](./LICENSE) for details.