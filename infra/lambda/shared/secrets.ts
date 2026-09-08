import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export interface AppSecrets {
  vapidPublicKey: string;
  vapidPrivateKey: string;
}

const client = new SecretsManagerClient({});

// Cached in module scope so warm invocations of the same execution
// environment reuse the value instead of calling Secrets Manager every time.
let cached: AppSecrets | undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getAppSecrets(): Promise<AppSecrets> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const secretId = process.env.SECRET_ARN || process.env.SECRET_NAME;
  if (!secretId) {
    throw new Error("SECRET_ARN/SECRET_NAME environment variable not set");
  }

  const result = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!result.SecretString) {
    throw new Error("Secret has no SecretString value");
  }

  const parsed = JSON.parse(result.SecretString) as Partial<AppSecrets>;

  if (!parsed.vapidPublicKey || !parsed.vapidPrivateKey) {
    throw new Error(
      "App secrets have not been bootstrapped yet. Run scripts/setup-secrets.mjs",
    );
  }

  cached = parsed as AppSecrets;
  cachedAt = now;
  return cached;
}
