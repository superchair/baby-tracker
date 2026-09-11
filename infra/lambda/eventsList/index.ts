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
// Absolute ceilings so a caller (or a bug) can't force an unbounded scan --
// the response gracefully truncates to the most recent data rather than
// erroring, both for date range width and item count.
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_ITEMS = 1000;
// Sorts after any typical id/timestamp suffix character.
const HIGH_SUFFIX = "￿";

async function queryAll(
  params: ConstructorParameters<typeof QueryCommand>[0],
  limit: number,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(
      new QueryCommand({
        ...params,
        ExclusiveStartKey,
        Limit: limit - items.length,
      }),
    );
    items.push(...((result.Items as Record<string, unknown>[]) ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey && items.length < limit);
  return items.slice(0, limit);
}

export async function handler(
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthCtx>,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    getCaregiverName(event);

    const qs = event.queryStringParameters ?? {};
    const now = new Date();

    const toMs = qs.to ? Date.parse(qs.to) : now.getTime();
    if (Number.isNaN(toMs)) {
      return errorResponse(400, "invalid to");
    }

    const fromMsRaw = qs.from ? Date.parse(qs.from) : toMs - THIRTY_DAYS_MS;
    if (Number.isNaN(fromMsRaw)) {
      return errorResponse(400, "invalid from");
    }
    // Clamp silently rather than erroring -- keeps the most recent portion
    // of an overly wide range instead of breaking the caller.
    const fromMs = Math.max(fromMsRaw, toMs - MAX_RANGE_MS);

    const from = new Date(fromMs).toISOString();
    const to = new Date(toMs).toISOString();
    const type = qs.type as EventType | undefined;

    if (type && !EVENT_TYPES.includes(type)) {
      return errorResponse(400, "invalid type");
    }

    let limit = MAX_ITEMS;
    if (qs.limit !== undefined) {
      const n = Number(qs.limit);
      if (!Number.isInteger(n) || n <= 0) {
        return errorResponse(400, "invalid limit");
      }
      limit = Math.min(n, MAX_ITEMS);
    }

    let items: Record<string, unknown>[];
    if (type) {
      items = await queryAll(
        {
          TableName: TABLE_NAME,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to",
          ExpressionAttributeValues: {
            ":pk": gsi1pkForType(type),
            ":from": from,
            ":to": to,
          },
          ScanIndexForward: false,
        },
        limit,
      );
    } else {
      items = await queryAll(
        {
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
          ExpressionAttributeValues: {
            ":pk": BABY_PK,
            ":from": `EVENT#${from}`,
            ":to": `EVENT#${to}${HIGH_SUFFIX}`,
          },
          ScanIndexForward: false,
        },
        limit,
      );
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
