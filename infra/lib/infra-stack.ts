import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { createTable } from './table';
import { createAppSecret } from './secrets';
import { createLambdas } from './lambdas';
import { createSite, deploySiteAssets } from './site';
import { createApi } from './api';
import { createReminderSchedule } from './reminder';

const LOCAL_DEV_ORIGIN = 'http://localhost:5173';
const SITE_DOMAIN_NAME = 'baby.brownserv.org';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = createTable(this);
    const secret = createAppSecret(this);
    const lambdas = createLambdas(this, table, secret);

    // Bucket + CloudFront distribution (created before the API so its
    // domain name is available for the API's CORS allow-list).
    const site = createSite(this, SITE_DOMAIN_NAME);

    const httpApi = createApi(this, lambdas, [
      `https://${SITE_DOMAIN_NAME}`,
      `https://${site.distribution.distributionDomainName}`,
      LOCAL_DEV_ORIGIN,
    ]);

    // Uploads ../frontend/dist (if built) plus a generated config.json
    // pointing at the API, and invalidates the CloudFront cache.
    deploySiteAssets(this, site, httpApi.apiEndpoint);

    createReminderSchedule(this, lambdas.reminderCheck);

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'Baby Tracker HTTP API invoke URL',
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${SITE_DOMAIN_NAME}`,
      description: 'Baby Tracker frontend URL (custom domain)',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: site.distribution.distributionDomainName,
      description: 'Underlying CloudFront domain -- point the Namecheap CNAME at this',
    });
  }
}
