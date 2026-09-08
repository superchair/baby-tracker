// Bridges the Auth0 React SDK (hooks-only) into the plain-function API
// client (api/client.ts), which can't call useAuth0() directly. AuthContext
// registers the real implementation once it has access to the SDK.

type TokenGetter = () => Promise<string | null>;

let getter: TokenGetter = async () => null;

export function setTokenGetter(fn: TokenGetter): void {
  getter = fn;
}

export function getAccessToken(): Promise<string | null> {
  return getter();
}
