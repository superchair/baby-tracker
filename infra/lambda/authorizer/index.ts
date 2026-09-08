import type { APIGatewayRequestAuthorizerEventV2 } from "aws-lambda";
import { verifier, caregiverNameFromHeader } from "../shared/auth0.js";

type AuthorizerContext = { caregiverName: string };

interface SimpleAuthorizerResult {
  isAuthorized: boolean;
  context?: AuthorizerContext;
}

export async function handler(
  event: APIGatewayRequestAuthorizerEventV2,
): Promise<SimpleAuthorizerResult> {
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isAuthorized: false };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const nameHeader =
    event.headers?.["x-caregiver-name"] || event.headers?.["X-Caregiver-Name"];

  try {
    const payload = await verifier.verify(token);
    return {
      isAuthorized: true,
      context: { caregiverName: caregiverNameFromHeader(nameHeader, payload) },
    };
  } catch {
    return { isAuthorized: false };
  }
}
