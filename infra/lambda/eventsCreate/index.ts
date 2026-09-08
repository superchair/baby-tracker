import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "../shared/ddb.js";
import { json, errorResponse, getCaregiverName, HttpError } from "../shared/http.js";
import {
  BABY_ID,
  BABY_PK,
  CreateEventBodySchema,
  EventRecord,
  detailsSchemaFor,
  eventSK,
  gsi1pkForType,
  toEventResponse,
} from "../shared/types.js";

type AuthCtx = { caregiverName: string };

export async function handler(
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthCtx>,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const caregiverName = getCaregiverName(event);

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return errorResponse(400, "invalid JSON body");
    }

    const parsed = CreateEventBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "invalid event body");
    }

    const { type, startTime, endTime, notes, details } = parsed.data;

    const detailsSchema = detailsSchemaFor(type);
    const detailsParsed = detailsSchema.safeParse(details ?? {});
    if (!detailsParsed.success) {
      return errorResponse(400, `invalid details for type ${type}`);
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const item: EventRecord = {
      PK: BABY_PK,
      SK: eventSK(startTime, id),
      GSI1PK: gsi1pkForType(type),
      GSI1SK: startTime,
      id,
      babyId: BABY_ID,
      type,
      startTime,
      endTime: endTime ?? null,
      createdBy: caregiverName,
      ...(notes !== undefined ? { notes } : {}),
      details: detailsParsed.data,
      createdAt,
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    return json(201, toEventResponse(item));
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
