import type { HttpHandler } from "msw";

// Intentionally empty. Tests register the handlers they need with
// `server.use(...)` so the mocked endpoints stay local to the test
// that depends on them. MSW is started with onUnhandledRequest:
// "error", so any unmocked fetch is a loud failure.
export const handlers: HttpHandler[] = [];
