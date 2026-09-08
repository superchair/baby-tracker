import { JwtRsaVerifier } from "aws-jwt-verify";

const MAX_NAME_LENGTH = 100;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable not set`);
  }
  return value;
}

// Verifier instance (and its JWKS cache) is created once per execution
// environment and reused across warm invocations.
export const verifier = JwtRsaVerifier.create({
  issuer: `https://${requireEnv("AUTH0_DOMAIN")}/`,
  audience: requireEnv("AUTH0_AUDIENCE"),
  jwksUri: `https://${requireEnv("AUTH0_DOMAIN")}/.well-known/jwks.json`,
});

/**
 * The caregiver's display name/email is supplied by the (already-authenticated)
 * frontend via this header, rather than a custom Auth0 Action claim -- simpler,
 * with no Auth0-dashboard dependency. This only affects event attribution
 * ("who logged this"), not access control: getting into the API at all still
 * requires a valid Auth0 access token, verified above.
 */
export function caregiverNameFromHeader(
  headerValue: string | undefined,
  payload: Record<string, unknown>,
): string {
  if (headerValue) {
    // The client percent-encodes this header value (Latin-1-safe transport
    // for names/emails with non-ASCII characters); tolerate malformed input.
    let decoded: string;
    try {
      decoded = decodeURIComponent(headerValue);
    } catch {
      decoded = headerValue;
    }
    const trimmed = decoded.trim();
    if (trimmed) {
      return trimmed.slice(0, MAX_NAME_LENGTH);
    }
  }
  return String(payload.sub);
}
