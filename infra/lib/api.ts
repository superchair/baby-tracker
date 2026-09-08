import * as cdk from 'aws-cdk-lib/core';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';
import { LambdaFunctions } from './lambdas';

export function createApi(
  scope: Construct,
  lambdas: LambdaFunctions,
  corsOrigins: string[],
): HttpApi {
  const authorizer = new HttpLambdaAuthorizer(
    'CaregiverAuthorizer',
    lambdas.authorizer,
    {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      resultsCacheTtl: cdk.Duration.minutes(5),
      identitySource: ['$request.header.Authorization', '$request.header.x-caregiver-name'],
    },
  );

  const httpApi = new HttpApi(scope, 'HttpApi', {
    apiName: 'BabyTrackerApi',
    corsPreflight: {
      allowOrigins: corsOrigins,
      allowHeaders: ['content-type', 'authorization', 'x-caregiver-name'],
      allowMethods: [
        CorsHttpMethod.GET,
        CorsHttpMethod.POST,
        CorsHttpMethod.PATCH,
        CorsHttpMethod.DELETE,
        CorsHttpMethod.OPTIONS,
      ],
      maxAge: cdk.Duration.hours(6),
    },
    defaultAuthorizer: authorizer,
  });

  httpApi.addRoutes({
    path: '/events',
    methods: [HttpMethod.POST],
    integration: new HttpLambdaIntegration('EventsCreateIntegration', lambdas.eventsCreate),
  });

  httpApi.addRoutes({
    path: '/events',
    methods: [HttpMethod.GET],
    integration: new HttpLambdaIntegration('EventsListIntegration', lambdas.eventsList),
  });

  httpApi.addRoutes({
    path: '/events/{id}',
    methods: [HttpMethod.PATCH],
    integration: new HttpLambdaIntegration('EventsUpdateIntegration', lambdas.eventsUpdate),
  });

  httpApi.addRoutes({
    path: '/events/{id}',
    methods: [HttpMethod.DELETE],
    integration: new HttpLambdaIntegration('EventsDeleteIntegration', lambdas.eventsDelete),
  });

  httpApi.addRoutes({
    path: '/config',
    methods: [HttpMethod.GET],
    integration: new HttpLambdaIntegration('ConfigGetIntegration', lambdas.configGet),
  });

  httpApi.addRoutes({
    path: '/config',
    methods: [HttpMethod.PATCH],
    integration: new HttpLambdaIntegration('ConfigUpdateIntegration', lambdas.configUpdate),
  });

  httpApi.addRoutes({
    path: '/push/vapid-public-key',
    methods: [HttpMethod.GET],
    integration: new HttpLambdaIntegration('PushVapidKeyIntegration', lambdas.pushVapidKey),
  });

  httpApi.addRoutes({
    path: '/push/subscribe',
    methods: [HttpMethod.POST],
    integration: new HttpLambdaIntegration('PushSubscribeIntegration', lambdas.pushSubscribe),
  });

  return httpApi;
}
