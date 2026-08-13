import { optionsResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  return jsonResponse(
    {
      error:
        "Generation is started by the Stripe webhook after payment is confirmed. The browser cannot start generation.",
    },
    409,
  );
});
