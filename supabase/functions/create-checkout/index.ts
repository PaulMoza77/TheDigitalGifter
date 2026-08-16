import { optionsResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  return jsonResponse(
    {
      error:
        "Credit packs and subscriptions are not part of the launch product. Use create-checkout-session for the €4.99 still-image purchase.",
    },
    410,
  );
});
