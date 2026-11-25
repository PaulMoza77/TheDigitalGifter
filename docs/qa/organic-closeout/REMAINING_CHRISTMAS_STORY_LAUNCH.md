# Remaining — Christmas Story vocals & commercial launch

Checkout stays **OFF** until every step below and **explicit owner launch approval**.

## Product state at freeze

- Prices prepared: **149 RON** / **$34.99**  
- Contabo workers: song (`licensed_fma` CC0) + film (FFmpeg)  
- Resend on `markSent` verified to authorized inbox only  
- Edge flag `CHRISTMAS_STORY_AUTOMATE_SONG`: **not injected** into runtime (safe default)  
- Personalized **vocals** not yet a commercial automated deliverable  

## Launch checklist

1. Contract + configure authorized personalized vocal/music provider.  
2. Update rights documentation; never present CC0 instrumental as final vocal master.  
3. Wire provider into Contabo song worker; cost-track API usage.  
4. Inject `CHRISTMAS_STORY_AUTOMATE_SONG=true` into edge compose **only** after provider is configured.  
5. Two fresh automated samples (non-mock); full COGS + duration + retry.  
6. Recipient mobile playback + download (if in offer).  
7. Delivery email policy for real recipients (Resend + suppression).  
8. Owner quality + price acceptance.  
9. Dedicated release flipping Story checkout LIVE (server + client).  
10. Separate approval for abandoned-checkout commercial send (28 eligible at last revalidation; re-query before send).
