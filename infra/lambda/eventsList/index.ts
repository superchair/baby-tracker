import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "../shared/ddb.js";
import { json, errorResponse, HttpError, getCaregiverName } from "../shared/http.js";
import {
  BABY_PK,
  EVENT_TYPES,
  EventRecord,
  EventType,
  gsi1pkForType,
  toEventResponse,
} from "../shared/types.js";

type AuthCtx = { caregiverName: string };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// Sorts after any typical id/timestamp suffix character.
const HIGH_SUFFIX = "￿";

async function queryAll(
  params: ConstructorParameters<typeof QueryCommand>[0],
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(
      new QueryCommand({ ...params, ExclusiveStartKey }),
    );
    items.push(...((result.Items as Record<string, unknown>[]) ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function handler(
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthCtx>,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    getCaregiverName(event);

    const qs = event.queryStringParameters ?? {};
    const now = new Date();
    const from = qs.from ?? new Date(now.getTime() - THIRTY_DAYS_MS).toISOString();
    const to = qs.to ?? now.toISOString();
    const type = qs.type as EventType | undefined;

    if (type && !EVENT_TYPES.includes(type)) {
      return errorResponse(400, "invalid type");
    }

    let items: Record<string, unknown>[];
    if (type) {
      items = await queryAll({
        TableName: TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":pk": gsi1pkForType(type),
          ":from": from,
          ":to": to,
        },
        ScanIndexForward: false,
      });
    } else {
      items = await queryAll({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":pk": BABY_PK,
          ":from": `EVENT#${from}`,
          ":to": `EVENT#${to}${HIGH_SUFFIX}`,
        },
        ScanIndexForward: false,
      });
    }

    const events = items
      .map((item) => toEventResponse(item as unknown as EventRecord))
      .sort((a, b) => (a.startTime < b.startTime ? 1 : a.startTime > b.startTime ? -1 : 0));

    return json(200, { events });
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
