# Environment Configurations

This directory holds per-environment configuration files for deployment and operational playbooks.

Each `.env` file contains environment metadata such as server hosts, code paths, ports, and build commands. Some files may also contain credentials for convenience in non-production environments; production secrets should ideally be stored in a secret manager or injected via CI/CD variables.

## Usage

Before running any deployment commands from `governance/PLAYBOOKS/deployment.md`, load the target environment:

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
```

Then execute the commands in the playbook; the `${VAR}` placeholders will resolve using the loaded config.

## Adding a New Environment

1. Copy `test.env` to a new file, e.g. `prod.env`.
2. Update all values for the new environment.
3. Do **not** commit secrets to the file.
4. Update `governance/PLAYBOOKS/deployment.md` only if the new environment requires different procedural steps; otherwise no SOP changes are needed.

## Existing Environments

| File | Environment | Description |
|------|-------------|-------------|
| `dev.env` | Development | mock-external-server 部署与运维 |
| `test.env` | Test | 功能验证、集成测试 |
| `prod.env` | Production | 线上生产环境 |
