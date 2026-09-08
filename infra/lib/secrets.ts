import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * CDK owns/tracks this secret's existence, but NOT its real contents.
 * A placeholder value is generated here so the resource is valid at create
 * time; the real VAPID keypair is populated afterwards by the one-time
 * `scripts/setup-secrets.mjs` bootstrap script (see README). Login is
 * handled by Auth0, not this secret.
 */
export function createAppSecret(scope: Construct): secretsmanager.Secret {
  return new secretsmanager.Secret(scope, 'AppSecrets', {
    secretName: 'baby-tracker/app-secrets',
    description:
      'Baby Tracker app secrets (vapidPublicKey, vapidPrivateKey). ' +
      'Populate real values with scripts/setup-secrets.mjs after first deploy.',
    generateSecretString: {
      secretStringTemplate: JSON.stringify({}),
      generateStringKey: 'placeholder',
    },
  });
}
