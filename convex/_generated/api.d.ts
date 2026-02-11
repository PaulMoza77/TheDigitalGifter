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
import type * as ai_veo3 from "../ai/veo3.js";
import type * as atomic from "../atomic.js";
import type * as auth from "../auth.js";
import type * as checkout from "../checkout.js";
import type * as constants from "../constants.js";
import type * as credits from "../credits.js";
import type * as data_templateMetadata from "../data/templateMetadata.js";
import type * as emailActions from "../emailActions.js";
import type * as emailPreferences from "../emailPreferences.js";
import type * as emails from "../emails.js";
import type * as fileUpload from "../fileUpload.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as jobs_video from "../jobs_video.js";
import type * as occasions from "../occasions.js";
import type * as orders from "../orders.js";
import type * as seedOccasions from "../seedOccasions.js";
import type * as storage from "../storage.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/replicate": typeof ai_replicate;
  "ai/veo3": typeof ai_veo3;
  atomic: typeof atomic;
  auth: typeof auth;
  checkout: typeof checkout;
  constants: typeof constants;
  credits: typeof credits;
  "data/templateMetadata": typeof data_templateMetadata;
  emailActions: typeof emailActions;
  emailPreferences: typeof emailPreferences;
  emails: typeof emails;
  fileUpload: typeof fileUpload;
  http: typeof http;
  jobs: typeof jobs;
  jobs_video: typeof jobs_video;
  occasions: typeof occasions;
  orders: typeof orders;
  seedOccasions: typeof seedOccasions;
  storage: typeof storage;
  templates: typeof templates;
  users: typeof users;
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

export declare const components: {};
