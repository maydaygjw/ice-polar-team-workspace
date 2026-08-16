# Environment Configurations

This directory holds per-environment configuration files for deployment and operational playbooks.

Each `.env` file contains environment metadata such as server hosts, code paths, ports, and build commands. Current production application settings follow the dev/test arrangement and are loaded from `application-prod.yaml`; future secret-manager migration may use a separate server-side environment file.

## Usage

Before running any deployment commands from `governance/PLAYBOOKS/deployment.md`, load the target environment:

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
```

Then execute the commands in the playbook; the `${VAR}` placeholders will resolve using the loaded config.

## Adding a New Environment

1. Copy `test.env` to a new file, e.g. `prod.env`.
2. Update all values for the new environment.
3. Do not commit secrets to the file. The current production exception is that DB/Redis passwords and OCR credentials remain in `application-prod.yaml` to match the existing dev/test arrangement; this will be unified in the later security remediation.
4. Update `governance/PLAYBOOKS/deployment.md` only if the new environment requires different procedural steps; otherwise no SOP changes are needed.

`prod.secrets.env.example` is reserved for the later secret-manager migration; it is not required by the current production startup path.

## Existing Environments

| File | Environment | Description |
|------|-------------|-------------|
| `dev.env` | Development | mock-external-server 部署与运维 |
| `test.env` | Test | 功能验证、集成测试 |
| `prod.env` | Production | 线上生产环境 |
