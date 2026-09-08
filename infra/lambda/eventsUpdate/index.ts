import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { GetCommand, PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "../shared/ddb.js";
import { json, errorResponse, HttpError, getCaregiverName } from "../shared/http.js";
import {
  BABY_PK,
  EventRecord,
  UpdateEventBodySchema,
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
    getCaregiverName(event);

    const id = event.pathParameters?.id;
    if (!id) {
      return errorResponse(400, "missing id");
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return errorResponse(400, "invalid JSON body");
    }

    const parsed = UpdateEventBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "invalid request body");
    }
    const { startTime, newStartTime, endTime, notes, details } = parsed.data;

    const oldKey = { PK: BABY_PK, SK: eventSK(startTime, id) };

    const existingResult = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: oldKey }),
    );
    const existing = existingResult.Item as EventRecord | undefined;
    if (!existing) {
      return errorResponse(404, "event not found");
    }

    let validatedDetails: EventRecord["details"] | undefined;
    if (details !== undefined) {
      const schema = detailsSchemaFor(existing.type);
      const detailsParsed = schema.safeParse(details);
      if (!detailsParsed.success) {
        return errorResponse(400, `invalid details for type ${existing.type}`);
      }
      validatedDetails = detailsParsed.data as EventRecord["details"];
    }

    const effectiveStartTime = newStartTime ?? existing.startTime;
    const isMoving = effectiveStartTime !== existing.startTime;

    const updated: EventRecord = {
      ...existing,
      SK: eventSK(effectiveStartTime, id),
      GSI1PK: gsi1pkForType(existing.type),
      GSI1SK: effectiveStartTime,
      startTime: effectiveStartTime,
      endTime: endTime !== undefined ? endTime : existing.endTime,
      notes: notes !== undefined ? notes : existing.notes,
      details: validatedDetails !== undefined ? validatedDetails : existing.details,
    };

    if (isMoving) {
      // DynamoDB can't change key attributes in place -- move the item to
      // its new sort key atomically.
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            { Delete: { TableName: TABLE_NAME, Key: oldKey } },
            { Put: { TableName: TABLE_NAME, Item: updated } },
          ],
        }),
      );
    } else {
      await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
    }

    return json(200, toEventResponse(updated));
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
