/**
 * Compatibility shim. Production origin uses server/node-api-compat.mjs.
 */
export {
  readJsonBody,
  queryFromUrl,
  decorateResponse,
  invokeNodeHandler,
  invokeVercelHandler,
} from "./node-api-compat.mjs";
