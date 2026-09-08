import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface LambdaFunctions {
  authorizer: nodejs.NodejsFunction;
  eventsCreate: nodejs.NodejsFunction;
  eventsList: nodejs.NodejsFunction;
  eventsUpdate: nodejs.NodejsFunction;
  eventsDelete: nodejs.NodejsFunction;
  configGet: nodejs.NodejsFunction;
  configUpdate: nodejs.NodejsFunction;
  pushVapidKey: nodejs.NodejsFunction;
  pushSubscribe: nodejs.NodejsFunction;
  reminderCheck: nodejs.NodejsFunction;
}

interface FnOptions {
  needsTable?: boolean;
  needsSecret?: boolean;
  timeout?: cdk.Duration;
  extraEnv?: Record<string, string>;
}

export function createLambdas(
  scope: Construct,
  table: dynamodb.Table,
  secret: secretsmanager.Secret,
): LambdaFunctions {
  const lambdaDir = path.join(__dirname, '..', 'lambda');

  function fn(name: string, options: FnOptions = {}): nodejs.NodejsFunction {
    const {
      needsTable = true,
      needsSecret = true,
      timeout = cdk.Duration.seconds(10),
      extraEnv,
    } = options;

    const environment: Record<string, string> = { ...extraEnv };
    if (needsTable) environment.TABLE_NAME = table.tableName;
    if (needsSecret) environment.SECRET_ARN = secret.secretArn;

    const f = new nodejs.NodejsFunction(scope, name, {
      entry: path.join(lambdaDir, name, 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout,
      environment,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    if (needsTable) table.grantReadWriteData(f);
    if (needsSecret) secret.grantRead(f);

    return f;
  }

  const eventsUpdate = fn('eventsUpdate', { needsSecret: false });
  // grantReadWriteData doesn't cover TransactWriteItems -- eventsUpdate needs
  // it to atomically move an event to a new sort key when its time is edited.
  table.grant(eventsUpdate, 'dynamodb:TransactWriteItems');

  return {
    authorizer: fn('authorizer', {
      needsTable: false,
      needsSecret: false,
      extraEnv: {
        AUTH0_DOMAIN: 'brownserv.us.auth0.com',
        AUTH0_AUDIENCE: 'https://baby.brownserv.org',
      },
    }),
    eventsCreate: fn('eventsCreate', { needsSecret: false }),
    eventsList: fn('eventsList', { needsSecret: false }),
    eventsUpdate,
    eventsDelete: fn('eventsDelete', { needsSecret: false }),
    configGet: fn('configGet', { needsSecret: false }),
    configUpdate: fn('configUpdate', { needsSecret: false }),
    pushVapidKey: fn('pushVapidKey', { needsTable: false }),
    pushSubscribe: fn('pushSubscribe', { needsSecret: false }),
    reminderCheck: fn('reminderCheck', { timeout: cdk.Duration.seconds(30) }),
  };
}
