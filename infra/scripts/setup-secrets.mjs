#!/usr/bin/env node
/**
 * One-time bootstrap script that populates the real values of the
 * `baby-tracker/app-secrets` Secrets Manager secret.
 *
 * CDK creates the secret with a placeholder value so it can grant Lambdas
 * read access to it, but it deliberately does NOT compute the real VAPID
 * keypair -- that happens here, once, after the first `cdk deploy` (the
 * secret must exist before this script can write to it).
 *
 * Login is handled by Auth0, not this secret -- it only holds the Web Push
 * VAPID keypair used for reminder notifications.
 *
 * Usage:
 *   node scripts/setup-secrets.mjs
 *
 * Run with the same AWS credentials/profile used to deploy the stack, e.g.:
 *   AWS_PROFILE=superchair node scripts/setup-secrets.mjs
 */

import webpush from "web-push";
import {
  SecretsManagerClient,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const SECRET_NAME = "baby-tracker/app-secrets";

async function main() {
  console.log("Generating VAPID keypair for web push...");
  const { publicKey: vapidPublicKey, privateKey: vapidPrivateKey } =
    webpush.generateVAPIDKeys();

  const secretValue = { vapidPublicKey, vapidPrivateKey };

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const client = new SecretsManagerClient({ region });

  console.log(`Writing secret "${SECRET_NAME}" in region ${region}...`);
  await client.send(
    new PutSecretValueCommand({
      SecretId: SECRET_NAME,
      SecretString: JSON.stringify(secretValue),
    }),
  );

  console.log("Done. Secret updated with VAPID keys.");
}

main().catch((err) => {
  console.error("Failed to set up secrets:", err);
  process.exitCode = 1;
});
