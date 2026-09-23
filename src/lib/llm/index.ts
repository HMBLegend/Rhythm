// Fails the build if this module is ever imported into client code,
// so the provider key cannot end up in the browser bundle.
import "server-only";

// The provider integration is built in Phase 6. The app must work fully without it.
export function getLlmApiKey(): string | undefined {
  return process.env.GROQ_API_KEY || undefined;
}
