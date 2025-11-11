import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const items = [
      // PORTRAIT TEMPLATES (3:4 ratio)
      {
        title: "Family by Tree (Cozy)",
        scene: "tree",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1543589077-47d81606c1bf?q=80&w=900",
        prompt: "Cozy indoor Christmas tree scene, warm fairy lights, wrapped gifts, wooden floor. Keep background intact; replace faces realistically from user photo. Natural skin tones, preserve lighting.",
        creditCost: 10,
        tags: ["family", "warm", "lights"],
        textDefault: "Merry Christmas!"
      },
      {
        title: "Faces on Ornaments",
        scene: "globes",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1543583101-7954cac4f9a1?q=80&w=900",
        prompt: "Close-up Christmas tree ornaments. Place user face cleanly inside glossy bauble reflection, no warping. Keep bokeh lights.",
        creditCost: 12,
        tags: ["ornaments", "portrait", "closeup"],
        textDefault: "Joy & Peace"
      },
      {
        title: "Fireplace Evening",
        scene: "fireplace",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=900",
        prompt: "Living room with fireplace, stockings, garland. Keep scene; composite user faces into people in frame, soft orange light.",
        creditCost: 10,
        tags: ["fireplace", "cozy", "evening"],
        textDefault: "Warm Wishes"
      },
      {
        title: "Kids by Tree - Playful",
        scene: "tree",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1519681392163-9200b0c7d0f9?q=80&w=900",
        prompt: "Playful Christmas setup with candy canes and toys. Child-friendly face swap with natural expressions.",
        creditCost: 10,
        tags: ["kids", "playful", "family"],
        textDefault: "Magic Moments"
      },
      {
        title: "Minimal Scandinavian Tree",
        scene: "tree",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1513885535751-8b9238bd345d?q=80&w=900",
        prompt: "Minimal white and pine Christmas tree. Subtle face swap with clean, modern aesthetic.",
        creditCost: 10,
        tags: ["minimal", "scandi", "modern"],
        textDefault: "Peace & Joy"
      },
      {
        title: "Winter Portrait Frame",
        scene: "portrait",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Elegant winter portrait frame with snow and pine branches. Replace portrait with user photo, maintain lighting.",
        creditCost: 12,
        tags: ["portrait", "elegant", "frame"],
        textDefault: "Season's Greetings"
      },
      {
        title: "Christmas Morning Pajamas",
        scene: "morning",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Christmas morning scene with opened presents and pajamas. Place family in cozy morning light with authentic emotions.",
        creditCost: 10,
        tags: ["morning", "family", "presents"],
        textDefault: "Christmas Magic"
      },
      {
        title: "Snow Globe Portrait",
        scene: "snowglobe",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Inside a magical snow globe with miniature Christmas village. Place user as tiny figures in the snow globe world, magical sparkles.",
        creditCost: 18,
        tags: ["snowglobe", "magical", "miniature"],
        textDefault: "Magical Holidays"
      },

      // LANDSCAPE TEMPLATES (4:3 ratio)
      {
        title: "Cookies Table Gathering",
        scene: "cookies",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1512406926044-444d641267ee?q=80&w=1200",
        prompt: "Festive table with Christmas cookies, mugs, pine cones. Insert user/family faces naturally around table, candid smiles, warm light.",
        creditCost: 10,
        tags: ["kitchen", "family", "cozy"],
        textDefault: "Sweet Holidays"
      },
      {
        title: "Winter Wonderland",
        scene: "outdoor",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544273677-6e4c999de2a6?q=80&w=1200",
        prompt: "Snowy outdoor Christmas scene with decorated trees, twinkling lights. Insert user/family in winter clothing, natural poses, magical atmosphere.",
        creditCost: 10,
        tags: ["outdoor", "snow", "winter"],
        textDefault: "Winter Wishes"
      },
      {
        title: "Luxe Tree Elegance",
        scene: "tree",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1512203492609-8f2b4f3f5f67?q=80&w=1200",
        prompt: "Luxurious tall Christmas tree, red-gold palette, many gifts. Keep décor; replace faces only with elegant styling.",
        creditCost: 12,
        tags: ["lux", "indoor", "elegant"],
        textDefault: "Elegant Holidays"
      },
      {
        title: "Outdoor Snow Street",
        scene: "outdoor",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1200",
        prompt: "Snowy street with lights and pine trees. Composite couple/family with cool blue winter tint.",
        creditCost: 10,
        tags: ["snow", "outside", "street"],
        textDefault: "Let it Snow"
      },
      {
        title: "Tree with Window Bokeh",
        scene: "tree",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1543832923-1a4f2a9d8b1b?q=80&w=1200",
        prompt: "Christmas tree near window with golden bokeh lights. Swap faces in family group setting.",
        creditCost: 10,
        tags: ["bokeh", "group", "warm"],
        textDefault: "Season's Greetings"
      },
      {
        title: "Presents & Lights Close-up",
        scene: "gifts",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?q=80&w=1200",
        prompt: "Wrapped gifts under tree with warm bokeh lights. Add small framed portrait on gift tag.",
        creditCost: 10,
        tags: ["gifts", "detail", "warm"],
        textDefault: "With Love"
      },

      // PREMIUM TEMPLATES
      {
        title: "Santa's Workshop",
        scene: "workshop",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Magical Santa's workshop with toys, elves, and Christmas magic. Insert user as helper elf or visitor, maintain whimsical atmosphere.",
        creditCost: 15,
        tags: ["santa", "workshop", "magical"],
        textDefault: "Ho Ho Ho!"
      },
      {
        title: "Christmas Market",
        scene: "market",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Festive Christmas market with wooden stalls, warm lights, hot cocoa. Place user/family as visitors enjoying the market atmosphere.",
        creditCost: 12,
        tags: ["market", "outdoor", "festive"],
        textDefault: "Market Magic"
      },
      {
        title: "Gingerbread House",
        scene: "gingerbread",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Whimsical gingerbread house scene with candy decorations. Transform user into gingerbread person or place in candy land setting.",
        creditCost: 15,
        tags: ["gingerbread", "whimsical", "candy"],
        textDefault: "Sweet Dreams"
      },
      {
        title: "Ice Skating Rink",
        scene: "skating",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Outdoor ice skating rink with Christmas lights and snow. Insert user/family as skaters, winter clothing, joyful expressions.",
        creditCost: 12,
        tags: ["skating", "outdoor", "winter"],
        textDefault: "Skating Joy"
      },
      {
        title: "Vintage Christmas",
        scene: "vintage",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Vintage 1950s Christmas scene with retro decorations, classic clothing. Style user in period-appropriate attire, sepia tones.",
        creditCost: 15,
        tags: ["vintage", "retro", "classic"],
        textDefault: "Vintage Wishes"
      }
    ];

    // Check if templates already exist to avoid duplicates
    const existingTemplates = await ctx.db.query("templates").collect();
    if (existingTemplates.length > 0) {
      return { success: false, message: "Templates already exist" };
    }

    // Insert all templates
    for (const item of items) {
      await ctx.db.insert("templates", item);
    }

    return { success: true, count: items.length };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").collect();
  },
});

export const getByScene = query({
  args: { scene: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("templates")
      .withIndex("by_scene", (q) => q.eq("scene", args.scene))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("templates").collect();
    for (const template of templates) {
      await ctx.db.delete(template._id);
    }
    return { success: true, deleted: templates.length };
  },
});

// Helper function to get templates by tags
export const getByTags = query({
  args: { tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const allTemplates = await ctx.db.query("templates").collect();
    return allTemplates.filter(template => 
      args.tags.some(tag => template.tags.includes(tag))
    );
  },
});

// Get templates by price range
export const getByPriceRange = query({
  args: { 
    minCost: v.optional(v.number()), 
    maxCost: v.optional(v.number()) 
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("templates");
    
    if (args.minCost !== undefined) {
      query = query.filter(q => q.gte(q.field("creditCost"), args.minCost!));
    }
    
    if (args.maxCost !== undefined) {
      query = query.filter(q => q.lte(q.field("creditCost"), args.maxCost!));
    }
    
    return await query.collect();
  },
});

// Create job from template - this is the main function you need
export const createFromTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    inputFileId: v.id("_storage"),
    additionalPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    // Get the template
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Check user has enough credits
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.credits < template.creditCost) {
      throw new Error("Insufficient credits");
    }

    // Debit credits
    await ctx.db.patch(userProfile._id, {
      credits: userProfile.credits - template.creditCost,
    });

    // Build the final prompt
    let finalPrompt = template.prompt;
    if (args.additionalPrompt) {
      finalPrompt += ` Additional instructions: ${args.additionalPrompt}`;
    }

    // Create the job
    const jobId = await ctx.db.insert("jobs", {
      userId,
      type: "card",
      prompt: finalPrompt,
      inputFileId: args.inputFileId,
      status: "queued",
      debited: template.creditCost,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Schedule the processing
    await ctx.scheduler.runAfter(0, internal.jobs.processTemplateJob, {
      jobId,
      templateId: args.templateId,
    });

    return {
      jobId,
      status: "queued",
      template: template.title,
      creditsCost: template.creditCost,
    };
  },
});

// Get templates by orientation
export const getByOrientation = query({
  args: { orientation: v.union(v.literal("portrait"), v.literal("landscape")) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("templates")
      .withIndex("by_orientation", (q) => q.eq("orientation", args.orientation))
      .collect();
  },
});

// Add more Christmas card templates
export const addMoreTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    const newTemplates = [
      // COZY CABIN SCENES
      {
        title: "Mountain Cabin",
        scene: "cabin",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1200",
        prompt: "Cozy log cabin in snowy mountains, warm windows glowing, smoke from chimney. Place user/family on porch or through windows, winter clothing, peaceful atmosphere.",
        creditCost: 12,
        tags: ["cabin", "mountains", "cozy"],
        textDefault: "Mountain Magic"
      },
      {
        title: "Cabin Fireplace Interior",
        scene: "cabin",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=900",
        prompt: "Inside rustic cabin with stone fireplace, plaid blankets, hot cocoa. Insert user/family in comfortable seating, warm lighting, rustic charm.",
        creditCost: 10,
        tags: ["cabin", "fireplace", "rustic"],
        textDefault: "Cozy Moments"
      },

      // WINTER WONDERLAND SCENES
      {
        title: "Snowy Forest Path",
        scene: "forest",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1200",
        prompt: "Enchanted snowy forest path with tall pines, soft snowfall. Place user/family walking together, winter coats, magical forest atmosphere.",
        creditCost: 12,
        tags: ["forest", "snow", "path"],
        textDefault: "Winter Walk"
      },
      {
        title: "Frozen Lake Vista",
        scene: "lake",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1200",
        prompt: "Frozen lake surrounded by snow-covered trees, mountain backdrop. Insert user/family ice skating or standing by shore, winter wonderland scene.",
        creditCost: 14,
        tags: ["lake", "frozen", "mountains"],
        textDefault: "Frozen Beauty"
      },

      // CHRISTMAS VILLAGE SCENES
      {
        title: "Village Square",
        scene: "village",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Charming Christmas village square with decorated shops, snow-covered roofs, church bells. Place user/family as villagers, festive clothing, community atmosphere.",
        creditCost: 15,
        tags: ["village", "community", "festive"],
        textDefault: "Village Joy"
      },
      {
        title: "Village Church",
        scene: "church",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Historic stone church with Christmas decorations, candlelit windows, snow falling. Insert user/family attending service or walking by, peaceful winter evening.",
        creditCost: 12,
        tags: ["church", "peaceful", "historic"],
        textDefault: "Silent Night"
      },

      // MAGICAL FANTASY SCENES
      {
        title: "Northern Lights",
        scene: "aurora",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=1200",
        prompt: "Aurora borealis dancing over snowy landscape, magical green lights. Place user/family silhouettes watching in wonder, winter gear, mystical atmosphere.",
        creditCost: 18,
        tags: ["aurora", "magical", "northern"],
        textDefault: "Northern Magic"
      },
      {
        title: "Enchanted Forest",
        scene: "enchanted",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Magical forest with glowing fairy lights in trees, mystical creatures. Transform user/family into fantasy characters, whimsical clothing, enchanted atmosphere.",
        creditCost: 20,
        tags: ["enchanted", "fairy", "magical"],
        textDefault: "Fairy Tale"
      },

      // COZY INDOOR SCENES
      {
        title: "Reading Nook",
        scene: "reading",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Cozy reading corner with Christmas books, soft blankets, tea. Insert user/family reading together, warm lamplight, peaceful domestic scene.",
        creditCost: 10,
        tags: ["reading", "cozy", "books"],
        textDefault: "Story Time"
      },
      {
        title: "Kitchen Baking",
        scene: "baking",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Warm kitchen with Christmas baking, flour dusted counters, fresh cookies. Place user/family as bakers, aprons, joyful cooking together.",
        creditCost: 10,
        tags: ["baking", "kitchen", "family"],
        textDefault: "Baking Joy"
      },

      // ELEGANT FORMAL SCENES
      {
        title: "Grand Ballroom",
        scene: "ballroom",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Elegant Christmas ballroom with crystal chandeliers, formal decorations. Insert user/family in formal attire, dancing or socializing, luxurious atmosphere.",
        creditCost: 16,
        tags: ["ballroom", "elegant", "formal"],
        textDefault: "Elegant Evening"
      },
      {
        title: "Victorian Christmas",
        scene: "victorian",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Victorian-era Christmas parlor with ornate decorations, gas lamps. Style user/family in period clothing, rich fabrics, historical elegance.",
        creditCost: 18,
        tags: ["victorian", "historical", "elegant"],
        textDefault: "Victorian Charm"
      },

      // FUN AND PLAYFUL SCENES
      {
        title: "Sledding Hill",
        scene: "sledding",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Snowy hill perfect for sledding, children playing, winter fun. Insert user/family sledding or building snowmen, active winter play, joyful expressions.",
        creditCost: 12,
        tags: ["sledding", "playful", "active"],
        textDefault: "Snow Fun"
      },
      {
        title: "Snow Angel Making",
        scene: "snowangels",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Fresh snow field perfect for snow angels, winter playground. Place user/family making snow angels, laughing, playful winter activities.",
        creditCost: 10,
        tags: ["snowangels", "playful", "fun"],
        textDefault: "Snow Angels"
      },

      // MINIMALIST MODERN SCENES
      {
        title: "Modern Minimal",
        scene: "modern",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Clean modern home with minimal Christmas decor, geometric tree. Insert user/family in contemporary setting, sleek design, understated elegance.",
        creditCost: 12,
        tags: ["modern", "minimal", "contemporary"],
        textDefault: "Modern Joy"
      },
      {
        title: "Scandinavian Hygge",
        scene: "hygge",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Cozy Scandinavian interior with candles, wool blankets, simple decorations. Place user/family in hygge moment, comfortable clothing, peaceful atmosphere.",
        creditCost: 10,
        tags: ["hygge", "scandinavian", "cozy"],
        textDefault: "Hygge Holidays"
      },

      // NEW FESTIVE TEMPLATES
      {
        title: "Cozy Cabin – Rustic",
        scene: "cabin",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=900",
        prompt: "Rustic cabin interior with stone fireplace, plaid blankets. Natural face swap with warm lighting.",
        creditCost: 10,
        tags: ["cabin", "rustic"],
        textDefault: "Cozy Christmas"
      },
      {
        title: "Snowy Forest – Magical",
        scene: "forest",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1200",
        prompt: "Enchanted snowy forest with tall pines, soft snowfall. Place family walking together in winter coats.",
        creditCost: 12,
        tags: ["forest", "magical"],
        textDefault: "Winter Magic"
      },
      {
        title: "Frozen Lake – Serene",
        scene: "lake",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?q=80&w=1200",
        prompt: "Frozen lake with snow-covered trees, mountain backdrop. Insert family ice skating or by shore.",
        creditCost: 14,
        tags: ["lake", "serene"],
        textDefault: "Peaceful Holidays"
      },
      {
        title: "Christmas Village – Charming",
        scene: "village",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Charming Christmas village with decorated shops, snow-covered roofs. Place family as villagers in festive clothing.",
        creditCost: 15,
        tags: ["village", "charming"],
        textDefault: "Village Christmas"
      },
      {
        title: "Church Bells – Peaceful",
        scene: "church",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Historic stone church with Christmas decorations, candlelit windows. Insert family attending service or walking by.",
        creditCost: 12,
        tags: ["church", "peaceful"],
        textDefault: "Silent Night"
      },
      {
        title: "Aurora Borealis – Mystical",
        scene: "aurora",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=1200",
        prompt: "Aurora borealis dancing over snowy landscape with magical green lights. Place family silhouettes watching in wonder.",
        creditCost: 18,
        tags: ["aurora", "mystical"],
        textDefault: "Northern Lights"
      },
      {
        title: "Fairy Forest – Enchanted",
        scene: "enchanted",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Magical forest with glowing fairy lights in trees. Transform family into fantasy characters with whimsical clothing.",
        creditCost: 20,
        tags: ["enchanted", "fairy"],
        textDefault: "Enchanted Christmas"
      },
      {
        title: "Reading Corner – Cozy",
        scene: "reading",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Cozy reading corner with Christmas books, soft blankets, tea. Insert family reading together in warm lamplight.",
        creditCost: 10,
        tags: ["reading", "cozy"],
        textDefault: "Story Time"
      },
      {
        title: "Baking Kitchen – Warm",
        scene: "baking",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Warm kitchen with Christmas baking, flour dusted counters, fresh cookies. Place family as bakers in aprons.",
        creditCost: 10,
        tags: ["baking", "warm"],
        textDefault: "Baking Together"
      },
      {
        title: "Grand Ballroom – Elegant",
        scene: "ballroom",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Elegant Christmas ballroom with crystal chandeliers, formal decorations. Insert family in formal attire dancing.",
        creditCost: 16,
        tags: ["ballroom", "elegant"],
        textDefault: "Elegant Christmas"
      },
      {
        title: "Victorian Parlor – Historic",
        scene: "victorian",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Victorian-era Christmas parlor with ornate decorations, gas lamps. Style family in period clothing with rich fabrics.",
        creditCost: 18,
        tags: ["victorian", "historic"],
        textDefault: "Victorian Christmas"
      },
      {
        title: "Sledding Fun – Playful",
        scene: "sledding",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Snowy hill perfect for sledding, children playing. Insert family sledding or building snowmen with joyful expressions.",
        creditCost: 12,
        tags: ["sledding", "playful"],
        textDefault: "Snow Day Fun"
      },
      {
        title: "Snow Angels – Joyful",
        scene: "snowangels",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Fresh snow field perfect for snow angels, winter playground. Place family making snow angels, laughing together.",
        creditCost: 10,
        tags: ["snowangels", "joyful"],
        textDefault: "Snow Angels"
      },
      {
        title: "Modern Home – Contemporary",
        scene: "modern",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200",
        prompt: "Clean modern home with minimal Christmas decor, geometric tree. Insert family in contemporary setting with sleek design.",
        creditCost: 12,
        tags: ["modern", "contemporary"],
        textDefault: "Modern Christmas"
      },
      {
        title: "Hygge Moment – Scandinavian",
        scene: "hygge",
        orientation: "portrait" as const,
        previewUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=900",
        prompt: "Cozy Scandinavian interior with candles, wool blankets, simple decorations. Place family in hygge moment with comfortable clothing.",
        creditCost: 10,
        tags: ["hygge", "scandinavian"],
        textDefault: "Hygge Christmas"
      },
      {
        title: "Town Square – Festive",
        scene: "outdoor",
        orientation: "landscape" as const,
        previewUrl: "https://images.unsplash.com/photo-1512314889357-e157c22f938d?q=80&w=1200",
        prompt: "Town square tree, stalls, lights. Natural tones face swap.",
        creditCost: 10,
        tags: ["square", "festive"],
        textDefault: "From Our Family"
      }
    ];

    // Insert all new templates
    for (const template of newTemplates) {
      await ctx.db.insert("templates", template);
    }

    return { success: true, added: newTemplates.length };
  },
});
