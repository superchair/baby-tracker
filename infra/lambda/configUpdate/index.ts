import type { APIGatewayProxyEventV2WithLambdaAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { json, errorResponse, HttpError, getCaregiverName } from "../shared/http.js";
import { getOrCreateConfig, saveConfig } from "../shared/config.js";
import { UpdateConfigBodySchema, toConfigResponse } from "../shared/types.js";

type AuthCtx = { caregiverName: string };

export async function handler(
  event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthCtx>,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    getCaregiverName(event);

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return errorResponse(400, "invalid JSON body");
    }

    const parsed = UpdateConfigBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "invalid config body");
    }
    const patch = parsed.data;

    const config = await getOrCreateConfig();

    if (patch.babyName !== undefined) {
      config.babyName = patch.babyName;
    }
    if (patch.babyBirthDate !== undefined) {
      config.babyBirthDate = patch.babyBirthDate;
    }
    if (patch.reminderThresholds) {
      config.reminderThresholds = {
        feedingMin:
          patch.reminderThresholds.feedingMin ?? config.reminderThresholds.feedingMin,
        diaperMin:
          patch.reminderThresholds.diaperMin ?? config.reminderThresholds.diaperMin,
      };
    }
    // lastNotifiedAt intentionally left untouched.

    await saveConfig(config);

    return json(200, toConfigResponse(config));
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.statusCode, err.message);
    }
    console.error(err);
    return errorResponse(500, "internal error");
  }
}
