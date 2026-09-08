import * as cdk from 'aws-cdk-lib/core';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export function createReminderSchedule(
  scope: Construct,
  reminderCheckFn: nodejs.NodejsFunction,
): events.Rule {
  return new events.Rule(scope, 'ReminderCheckSchedule', {
    schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
    targets: [new targets.LambdaFunction(reminderCheckFn)],
  });
}
