/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyses from "../analyses.js";
import type * as claims from "../claims.js";
import type * as contextPipeline from "../contextPipeline.js";
import type * as devin from "../devin.js";
import type * as events from "../events.js";
import type * as evidence from "../evidence.js";
import type * as jobs from "../jobs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyses: typeof analyses;
  claims: typeof claims;
  contextPipeline: typeof contextPipeline;
  devin: typeof devin;
  events: typeof events;
  evidence: typeof evidence;
  jobs: typeof jobs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  contextDev: import("@context-dot-dev/convex/_generated/component.js").ComponentApi<"contextDev">;
};
