import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Single-table design for the baby tracker app.
 *
 * Item shapes:
 *  - Event:        PK=BABY#<babyId>       SK=EVENT#<startTimeISO>#<eventId>
 *                   GSI1PK=BABY#<babyId>#TYPE#<type>  GSI1SK=<startTimeISO>
 *  - Push sub:     PK=PUSHSUB              SK=sha256(endpoint) hex
 *  - Household cfg: PK=CONFIG              SK=HOUSEHOLD
 */
export function createTable(scope: Construct): dynamodb.Table {
  const table = new dynamodb.Table(scope, 'BabyTrackerTable', {
    tableName: 'BabyTrackerTable',
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  table.addGlobalSecondaryIndex({
    indexName: 'GSI1',
    partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  });

  return table;
}
