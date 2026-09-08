// Bridges the Auth0 React SDK's user profile into the plain-function API
// client (api/client.ts), which can't call useAuth0() directly. AuthContext
// keeps this in sync with the current user whenever it changes.

let currentName: string | null = null;

export function setCaregiverName(name: string | null): void {
  currentName = name;
}

export function getCaregiverName(): string | null {
  return currentName;
}
