# Baby Tracker — infra

AWS CDK (TypeScript) stack for the baby event tracker backend: a single
DynamoDB table, a set of Lambda functions behind an HTTP API (API Gateway
v2) with a Lambda authorizer that verifies Auth0-issued access tokens, a
Secrets Manager secret for push credentials, an EventBridge-scheduled
reminder check, and an S3 + CloudFront static site for the frontend.

Login/identity is handled entirely by Auth0 (tenant `brownserv.us.auth0.com`)
— this stack never sees a password or PIN, it only verifies the access
tokens Auth0 issues.

## AWS account / profile — read this first

**All AWS CLI and CDK commands for this project must be run against the
`superchair` AWS profile (region `us-east-1`).**
This is a different account than your default CLI profile — do not deploy
this stack under any other profile/account.

Concretely:

- Any `aws ...` command: add `--profile superchair`.
- Any `npx cdk ...` command: set `AWS_PROFILE=superchair` in the
  environment, e.g. `AWS_PROFILE=superchair npx cdk deploy`.
- `scripts/setup-secrets.mjs` uses the default AWS SDK credential chain, so
  run it as `AWS_PROFILE=superchair node scripts/setup-secrets.mjs`.

The `superchair` account/region is already CDK-bootstrapped (`CDKToolkit`
stack present, bootstrap version 32 as of this writing), so `cdk bootstrap`
is **not** required before the first deploy. If you ever target a
different account/region, check first with
`aws cloudformation describe-stacks --stack-name CDKToolkit --profile <profile> --region <region>`
and run `AWS_PROFILE=<profile> npx cdk bootstrap` if that stack doesn't
exist.

## Prerequisites

- Node.js 20+ and npm.
- AWS CLI authenticated with the `superchair` profile.
- No CDK CLI install needed — everything runs through `npx cdk ...` using
  the `aws-cdk` devDependency pinned in `package.json`.

## One-time setup

```bash
npm install
```

## Build the frontend first

The static site deployment (`lib/site.ts`) uploads `../frontend/dist` to
S3. Build the frontend before deploying (or redeploying) so that directory
exists:

```bash
cd ../frontend
npm install
npm run build
cd ../infra
```

If `../frontend/dist` doesn't exist yet, `cdk synth`/`cdk deploy` will
still succeed — the stack will just skip uploading the frontend bundle
(only `config.json` gets deployed) and print a synth-time warning. Build
the frontend and re-run `cdk deploy` once it's ready.

## Deploy

```bash
AWS_PROFILE=superchair npx cdk synth    # sanity-check the generated template
AWS_PROFILE=superchair npx cdk deploy
```

`cdk deploy` provisions everything: the DynamoDB table, the Secrets
Manager secret (with a placeholder value), all Lambda functions, the HTTP
API, the S3 bucket + CloudFront distribution (with the frontend bundle if
it was built), and the EventBridge reminder schedule. It prints two stack
outputs when done:

- `ApiUrl` — the HTTP API's invoke URL.
- `SiteUrl` — the CloudFront distribution's URL (this is what you open in
  a browser to use the app).

CDK may prompt for approval before creating IAM roles/policies — that's
expected for a first deploy of a stack with this many Lambda functions;
review and confirm it interactively rather than passing
`--require-approval never`.

## One-time secrets bootstrap (required after the first deploy)

The `AppSecrets` secret (`baby-tracker/app-secrets`) is created by CDK
with a placeholder value only — CDK does not (and should not) compute your
real VAPID web-push keypair. The secret must already exist before this
script can write to it, so run it **once, after the first successful
`cdk deploy`**:

```bash
AWS_PROFILE=superchair node scripts/setup-secrets.mjs
```

This generates and writes `vapidPublicKey` / `vapidPrivateKey` — a VAPID
keypair used to send web push notifications. Only re-run this if you
intentionally want to rotate the VAPID keypair (existing push subscriptions
will stop working and caregivers will need to re-enable notifications).

The Lambda functions cache the secret in module scope for a few minutes,
so a rotation may take up to that long to take effect on warm Lambda
execution environments.

## Auth0 configuration

Login/identity is handled by Auth0, not this stack. The authorizer Lambda
(`lambda/authorizer`) verifies access tokens against:

- Tenant domain: `brownserv.us.auth0.com`
- API audience: `https://baby.brownserv.org`

These are set as plain (non-secret) environment variables on the
authorizer in `lib/lambdas.ts` — JWKS is public, so no secret is needed to
verify tokens. The Auth0 tenant itself (Application settings, Grant Types,
the Login Action that adds a `name` claim) is configured directly in the
Auth0 dashboard, not through this stack.

## Redeploying after frontend changes

The frontend is uploaded to S3 as a CDK asset (`Source.asset('../frontend/dist')`),
so CDK only re-uploads it when that directory's contents change and you
run `cdk deploy` again. After any frontend change:

```bash
cd ../frontend && npm run build && cd ../infra
AWS_PROFILE=superchair npx cdk deploy
```

This also re-runs the `BucketDeployment`, which invalidates the CloudFront
distribution (`distributionPaths: ['/*']`) so the new build is served
immediately.

## Architecture summary

- **DynamoDB** — single table `BabyTrackerTable` (PAY_PER_REQUEST,
  `PK`/`SK`, GSI `GSI1` on `GSI1PK`/`GSI1SK`) holding events, push
  subscriptions, and a singleton household config item.
- **Secrets Manager** — `baby-tracker/app-secrets`, bootstrapped via
  `scripts/setup-secrets.mjs` (see above).
- **Lambda** — Node.js 20.x / ARM_64, bundled with esbuild via
  `aws-lambda-nodejs`. Handlers live under `lambda/<name>/index.ts`,
  sharing common DynamoDB/secrets/Auth0-verification helpers under
  `lambda/shared/`.
- **HTTP API** (API Gateway v2) — routes listed in `lib/api.ts`, all
  protected by a Lambda authorizer (`lambda/authorizer`) that verifies
  Auth0-issued access tokens via JWKS. CORS is scoped to the custom domain
  site URL plus `http://localhost:5173` for local frontend development.
- **S3 + CloudFront** — private bucket behind CloudFront using Origin
  Access Control; SPA-friendly 403/404 → `/index.html` (200) error
  mapping; deploys `../frontend/dist` plus a generated `config.json`
  (`{ "apiUrl": "..." }`) that the frontend fetches at runtime.
- **EventBridge** — a 15-minute rate rule triggers `lambda/reminderCheck`,
  which checks the most recent FEEDING/DIAPER event against configured
  thresholds and sends web push reminders, deduping via
  `CONFIG.lastNotifiedAt`.

## Useful commands

- `npm run build` — type-check the project (`tsc --noEmit`-equivalent).
- `npm run test` — run Jest unit tests.
- `AWS_PROFILE=superchair npx cdk synth` — emit the CloudFormation template.
- `AWS_PROFILE=superchair npx cdk diff` — compare deployed stack with
  current code.
- `AWS_PROFILE=superchair npx cdk deploy` — deploy/update the stack.
