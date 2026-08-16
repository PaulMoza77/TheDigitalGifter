import { optionsResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  return jsonResponse(
    {
      error: "Subscriptions are not part of the launch product.",
    },
    410,
  );
});
