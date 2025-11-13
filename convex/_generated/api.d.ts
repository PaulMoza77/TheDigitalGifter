/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_replicate from "../ai/replicate.js";
import type * as auth from "../auth.js";
import type * as checkout from "../checkout.js";
import type * as constants from "../constants.js";
import type * as credits from "../credits.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as storage from "../storage.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "ai/replicate": typeof ai_replicate;
  auth: typeof auth;
  checkout: typeof checkout;
  constants: typeof constants;
  credits: typeof credits;
  http: typeof http;
  jobs: typeof jobs;
  storage: typeof storage;
  templates: typeof templates;
  users: typeof users;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
