import { StackClientApp } from "@stackframe/js";

export const stackClientApp = new StackClientApp({
  tokenStore: "cookie",
  // Explicitly pass projectId to avoid relying on implicit env resolution
  projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  // get your Stack Auth API keys from https://app.stack-auth.com
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
});
