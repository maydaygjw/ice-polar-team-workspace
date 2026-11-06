# Environment Configurations

This directory contains the active `dev` and `prod` environment metadata used by operational playbooks and deployment scripts.

## Usage

Load the target environment from the workspace root:

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env dev
# Or:
source governance/SCRIPTS/deploy-helper.sh && load_env prod
```

The loaded values are exported to child processes. Do not print the full environment or commit credentials.

## Environment Files

| File | Environment | Purpose |
|------|-------------|---------|
| `dev.env` | Development | Dev service, database, Redis, and mock-external-server operations |
| `prod.env` | Production | Production deployment metadata and approved external operations access |

Production application credentials and effective runtime settings are provided by the production application configuration. `prod.env` contains the external RDS address used by approved local operations; it may differ from the address used inside the production runtime network. Confirm the actual target before database access.

Database schema changes follow the Flyway and `db-migrator` process in the deployment playbook. Environment metadata files do not replace that process.
