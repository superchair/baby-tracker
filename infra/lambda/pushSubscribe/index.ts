import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createHash } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "../shared/ddb.js";
import { json, errorResponse, HttpError, getCaregiverName } from "../shared/http.js";
import { PUSHSUB_PK, PushSubscribeBodySchema, PushSubscriptionRecord } from "../shared/types.js";

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

    const parsed = PushSubscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "invalid subscription body");
    }
    const { endpoint, keys } = parsed.data;

    const sk = createHash("sha256").update(endpoint).digest("hex");

    const item: PushSubscriptionRecord = {
      PK: PUSHSUB_PK,
      SK: sk,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      createdBy: caregiverName,
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));

    return json(200, { ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
