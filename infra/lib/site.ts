import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface Site {
  bucket: s3.Bucket;
  distribution: cloudfront.Distribution;
  domainName?: string;
}

export function createSite(scope: Construct, domainName?: string): Site {
  const bucket = new s3.Bucket(scope, 'SiteBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
  });

  // CloudFront requires the certificate for a custom domain to live in
  // us-east-1 regardless of where the distribution's origin is -- this
  // stack already deploys there, so no cross-region setup is needed.
  // DNS is managed externally at Namecheap (not Route 53), so validation
  // is manual: CloudFormation will pause deployment until the CNAME this
  // produces is added at the registrar and ACM sees it.
  const certificate = domainName
    ? new acm.Certificate(scope, 'SiteCertificate', {
        domainName,
        validation: acm.CertificateValidation.fromDns(),
      })
    : undefined;

  const distribution = new cloudfront.Distribution(scope, 'SiteDistribution', {
    defaultRootObject: 'index.html',
    domainNames: domainName ? [domainName] : undefined,
    certificate,
    defaultBehavior: {
      origin: S3BucketOrigin.withOriginAccessControl(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    },
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
      },
      {
        httpStatus: 404,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
      },
    ],
  });

  return { bucket, distribution, domainName };
}

/**
 * Deploys the built frontend (../frontend/dist) plus a generated config.json
 * containing the CDK-resolved API URL, so the static SPA can fetch its API
 * endpoint at runtime without needing it at build time.
 */
export function deploySiteAssets(
  scope: Construct,
  site: Site,
  apiEndpoint: string,
): void {
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

  const sources: s3deploy.ISource[] = [
    s3deploy.Source.jsonData('config.json', { apiUrl: apiEndpoint }),
  ];

  if (fs.existsSync(frontendDist)) {
    sources.push(s3deploy.Source.asset(frontendDist));
  } else {
    // The frontend hasn't been built yet (`cd ../frontend && npm run build`).
    // Don't fail synth/deploy over it -- deploy what we have (just config.json)
    // and note that a follow-up `cdk deploy` is needed once the frontend is built.
    cdk.Annotations.of(scope).addWarning(
      `../frontend/dist not found -- skipping frontend asset upload. ` +
        `Build the frontend and re-run "cdk deploy" to publish it.`,
    );
  }

  new s3deploy.BucketDeployment(scope, 'SiteDeployment', {
    destinationBucket: site.bucket,
    distribution: site.distribution,
    distributionPaths: ['/*'],
    sources,
  });
}
