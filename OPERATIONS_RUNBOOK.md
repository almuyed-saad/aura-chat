# Aura Operations Runbook

This runbook covers the two remaining production-hardening workflows: MongoDB backups with a manual non-production restore drill, and a guarded Socket.io load test for concurrent users and long conversations.

## Automated MongoDB backups

The workflow `.github/workflows/mongodb-backup.yml` runs daily at **02:17 UTC** and can also be started manually from GitHub Actions. It uses MongoDB Database Tools to create a compressed archive, writes a SHA-256 checksum, and uploads the archive as a private GitHub Actions artifact retained for 14 days.

Configure the repository secret `MONGO_BACKUP_URI` with a MongoDB URI that has read access to the Aura database. Do not put this URI in the repository, workflow file, frontend variables, or logs. The backup archive is compressed; GitHub Actions artifact storage should be treated as access-controlled storage, not as a substitute for a separate long-term encrypted backup vault.

## Non-production restore drill

The workflow `.github/workflows/mongodb-restore-drill.yml` is intentionally manual because `mongorestore --drop` replaces collections in the target database. Run it against a dedicated staging or test database only. The workflow requires selecting `staging` or `test`, downloading a selected backup artifact by workflow run ID, validating its checksum, restoring it into the secret `MONGO_RESTORE_URI`, and checking that the `users` and `messages` collections exist and contain data.

The restore target must be a separate database from production. A staging URI should use an explicit staging database name and a database user limited to that database. A successful drill proves that the archive can be restored and that the application’s essential collections are present; it does not prove that every external media object or third-party configuration can be restored.

## Staging load test

The harness is `backend/ops/load-test.mjs` and is available as `npm run ops:load-test` from the backend directory. It logs in with pre-created test accounts, opens authenticated Socket.io connections, sends bounded direct messages with unique idempotency IDs, waits for `messageAcknowledged`, and measures history retrieval latency. It reports total attempts, failures, acknowledgement timeouts, and p95 login, connection, send, and history timings.

The harness is protected by default. It refuses public targets unless `LOAD_TEST_ALLOW_PRODUCTION=true` is explicitly set, and it refuses to create traffic unless `LOAD_TEST_CONFIRM=I_UNDERSTAND_TEST_DATA` is set. Use `LOAD_TEST_DRY_RUN=true` to validate configuration without logging in or sending traffic. Credentials are supplied only through `LOAD_TEST_USERS` as a JSON array of `{email,password}` objects and are never printed.

A safe staging example is:

```bash
cd backend
LOAD_TEST_BASE_URL=https://aura-staging.example.com \
LOAD_TEST_USERS='[{"email":"load-a@example.com","password":"use-a-test-secret"},{"email":"load-b@example.com","password":"use-a-test-secret"}]' \
LOAD_TEST_MESSAGES_PER_USER=25 \
LOAD_TEST_CONFIRM=I_UNDERSTAND_TEST_DATA \
npm run ops:load-test
```

The harness does create real test messages. Run it only with disposable test accounts and a staging database, and record the output as a baseline before and after major backend changes. It does not automatically delete test messages because deletion would make the test unsafe for shared data and could interfere with normal chat history.

## Current deployment expectation

These workflows are repository-side operational tooling. The backup schedule starts only after the workflow is merged and GitHub Actions is enabled with `MONGO_BACKUP_URI`. The restore drill requires both a selected backup artifact and `MONGO_RESTORE_URI`. The load test requires a staging deployment and test credentials. None of the workflows exposes database credentials to the frontend or changes normal chat behavior.
