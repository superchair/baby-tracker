import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "../shared/ddb.js";
import { noContent, errorResponse, HttpError, getCaregiverName } from "../shared/http.js";
import { BABY_PK, eventSK } from "../shared/types.js";

type AuthCtx = { caregiverName: string };

export async function handler(
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthCtx>,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    getCaregiverName(event);

    const id = event.pathParameters?.id;
    const startTime = event.queryStringParameters?.startTime;
    if (!id || !startTime) {
      return errorResponse(400, "id and startTime are required");
    }

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: BABY_PK, SK: eventSK(startTime, id) },
      }),
    );

    return noContent();
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
