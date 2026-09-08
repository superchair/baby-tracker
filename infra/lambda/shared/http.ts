import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function json(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204, body: "" };
}

export function errorResponse(
  statusCode: number,
  message: string,
): APIGatewayProxyStructuredResultV2 {
  return json(statusCode, { error: message });
}

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getCaregiverName(event: {
  requestContext: { authorizer?: { lambda?: Record<string, unknown> } };
}): string {
  const name = event.requestContext.authorizer?.lambda?.caregiverName;
  if (typeof name !== "string" || !name) {
    throw new HttpError(401, "unauthorized");
  }
  return name;
}
