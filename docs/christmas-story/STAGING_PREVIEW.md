# Staging preview instructions

## Local

```bash
npm run dev
```

Open:

1. http://localhost:5173/christmas-story  
2. http://localhost:5173/christmas-story?v=song  
3. http://localhost:5173/christmas-story/demo  
4. http://localhost:5173/christmas-story/create  
5. Complete test order → buyer dashboard → open `/gift/<token>`

## Mobile

Use phone on the same network or browser device mode. Demo + creator are mobile-first.

## Safety

- No production deploy from this mission  
- No Stripe LIVE  
- No paid AI song generation  
- Do not merge to `main` without explicit authorization  

## Production staging

Only if an existing safe staging host is authorized separately. This branch does not ship a deploy script for the story product.
