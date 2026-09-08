import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { json, errorResponse, HttpError, getCaregiverName } from "../shared/http.js";
import { getOrCreateConfig } from "../shared/config.js";
import { toConfigResponse } from "../shared/types.js";

type AuthCtx = { caregiverName: string };

export async function handler(
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthCtx>,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    getCaregiverName(event);
    const config = await getOrCreateConfig();
    return json(200, toConfigResponse(config));
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
