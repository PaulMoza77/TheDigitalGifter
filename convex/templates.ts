import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// Minimal types/helpers needed by this file
type TemplateSeed = any;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Must be logged in");
  const user = await ctx.db.get(userId);
  const email = (user as any)?.email;
  if (!email || !ADMIN_EMAILS.includes(email)) {
    throw new Error("Admin privileges required");
  }
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeTemplate(template: Doc<"templates">) {
  return {
    _id: (template as any)._id,
    _creationTime: (template as any)._creationTime,
    slug: slugify((template as any).title || ""),
    title: (template as any).title || "",
    category: (template as any).category || "",
    subCategory: (template as any).subCategory || "",
    // Normalize legacy template types to a standardized set for the frontend
    // Legacy values like "photo" or "card" are normalized to "image".
    type: (function () {
      const t = (template as any).type;
      if (!t) return "image";
      if (t === "video") return "video";
      // treat variants ('photo', 'card', etc.) as image
      return "image";
    })(),
    orientation: (template as any).orientation || "portrait",
    aspectRatio: (template as any).aspectRatio || "",
    previewUrl: (template as any).previewUrl || "",
    thumbnailUrl: (template as any).thumbnailUrl || "",
    creditCost: (template as any).creditCost || 0,
    tags: (template as any).tags || [],
    scene: (template as any).scene || "",
    textDefault: (template as any).textDefault || "",
  };
}

export const createFromTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    inputFileId: v.id("_storage"),
    additionalPrompt: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    // Validate additionalPrompt length to reduce prompt injection risk
    if (args.additionalPrompt && args.additionalPrompt.length > 2000) {
      throw new Error("Additional prompt must be less than 2000 characters");
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

    // Build the final prompt by merging template base prompt with user input
    // Structure: [Template Base Prompt] + [Custom Text if provided] + [Additional Instructions if provided]
    let finalPrompt = template.prompt;

    // Extract custom text from additionalPrompt if it contains "Include text:"
    let customText = "";
    let additionalInstructions = args.additionalPrompt || "";

    if (additionalInstructions.includes("Include text:")) {
      const textMatch = additionalInstructions.match(
        /Include text:\s*"([^"]+)"/
      );
      if (textMatch && textMatch[1]) {
        customText = textMatch[1];
        // Remove the custom text part from additional instructions
        additionalInstructions = additionalInstructions
          .replace(/Include text:\s*"[^"]+"/, "")
          .trim();
      }
    }

    // Merge prompts in structured format
    if (customText) {
      finalPrompt += ` Include the text "${customText}" in the image.`;
    }

    if (additionalInstructions) {
      finalPrompt += ` Additional instructions: ${additionalInstructions}`;
    }

    // Atomically debit credits and create the job via centralized internal mutation
    const jobId: Id<"jobs"> = await ctx.runMutation(
      (internal as any).atomic.debitCreditsAndCreateJob,
      {
        userId,
        templateId: args.templateId,
        creditCost: template.creditCost,
        inputFileIds: args.inputFileId ? [args.inputFileId] : [],
        prompt: finalPrompt,
        aspectRatio: args.aspectRatio,
        type: "image",
      }
    );

    // Schedule AI generation directly if input file exists
    if (args.inputFileId) {
      await ctx.scheduler.runAfter(0, internal.jobs.generateWithAI, {
        inputFileIds: [args.inputFileId],
        prompt: finalPrompt,
        jobId,
        aspectRatio: args.aspectRatio,
      });
    } else {
      // Fallback: use processTemplateJob for jobs without input files
      await ctx.scheduler.runAfter(0, internal.jobs.processTemplateJob, {
        jobId,
        templateId: args.templateId,
      });
    }

    return {
      jobId,
      status: "queued",
      template: template.title,
      creditsCost: template.creditCost,
    };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Seed templates matching src/constants/templates.ts structure
    // These templates are used in the UI and must match by title
    const items: TemplateSeed[] = [
      {
        title: "Gift Unwrapping Moment",
        category: "Classic",
        subCategory: "Family",
        type: "image",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/32d88747-c256-4285-9edb-9b4a6d0a77d7",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, and all physical characteristics of every uploaded person without ANY changes. Face preservation is the absolute priority. \nShow uploaded people unwrapping Christmas gifts together in a warm living room during evening.Background elements: decorated Christmas tree with golden ornaments and white lights, stone fireplace with stockings, wrapped presents in red and gold paper on floor, pine garlands on mantel with candles.Soft string lights on walls, plush rugs, comfortable furniture.Warm 2700K lighting creates cozy glow.People wear casual sweaters or pajamas, showing genuine joy and excitement with wrapping paper around them.Candid moment, shallow depth of field, 8K quality, warm natural tones. \nREMINDER: Keep all uploaded faces and bodies completely unchanged.",
        creditCost: 10,
        tags: [
          "classic",
          "family",
          "portrait",
          "tree",
          "evening",
          "elegant",
          "luxury",
        ],
        scene: "tree",
        textDefault: "Merry Christmas!",
      },
      {
        title: "Grand Evergreen Portrait",
        category: "Classic",
        subCategory: "Couple / Duo",
        type: "photo",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/5d2d4c32-8193-4763-b136-2e7a8d950f96",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Grand Evergreen Portrait' Classic Christmas template. Replace the background with: Classic Christmas tree with ornaments and warm bokeh lights in an elegant living room. Use warm practical lighting style. Update outfits only to fit a festive classic Christmas look (sweaters, coats, dresses) while keeping overall realism. Maintain the original camera angle and composition. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or with preserving the subjects. \n REMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 12,
        tags: ["classic", "couple / duo", "portrait", "tree"],
        scene: "tree",
        textDefault: "Season's Greetings",
      },
      {
        title: "Festive Dinner Table",
        category: "Classic",
        subCategory: "Couple / Dou",
        type: "photo",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/832ce66a-423b-4d1a-96a2-d0aa52438d1f",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Do not add any new people or faces to the scene. \nEdit the uploaded photo to match the 'Festive Dinner Table' Classic Christmas template. Replace the environment with: Candle-lit elegant dinner table setting with crystal glasses, fine china, red and green festive accents, Christmas centerpiece with pine branches and ornaments. Use warm practical lighting style with soft candlelight glow creating intimate atmosphere. Keep the general framing and orientation of the original photo. Apply shallow depth of field focusing on the subjects. If additional user preferences are provided, apply them only to atmosphere, colors, and small decorative elements without conflicting with the template or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged. Do not add new people.",
        creditCost: 24,
        tags: ["candle", "classic", "landscape", "scene / no people", "table"],
        scene: "table",
        textDefault: "Warm Wishes",
      },
      {
        title: "Red & Gold Card",
        category: "Classic",
        subCategory: "Card / No people",
        type: "card",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/8f9799ba-b25a-4b57-8799-03c12946a43f",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. \n Edit the uploaded image into a polished Christmas greeting card that matches the 'Red & Gold Card' template. Create a clean card layout with: Minimal red and gold decorative border, elegant snowflake accents in corners, ample clear space for greeting text placement. Use warm practical lighting style creating festive glow. Keep uploaded people visible and unchanged while integrating them into the card design. Maintain the overall orientation and composition of the original photo. Apply professional greeting card styling with festive red-gold color palette. If additional user preferences are provided, apply them only to color palette variations, decorative details, or text mood without conflicting with the template design or subject preservation. \n REMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged in the final card design.",
        creditCost: 6,
        tags: [
          "card",
          "card / no people",
          "classic",
          "minimal",
          "portrait",
          "snow",
        ],
        scene: "tree",
        textDefault: "Merry Christmas!",
      },
      {
        title: "By the Hearth",
        category: "Cozy",
        subCategory: "Couple / Duo",
        type: "photo",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/34d7ef5e-5ecd-4ada-b3d8-93349d9d8076",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'By the Hearth' Cozy Christmas template. Replace the background with: Intimate scene near a crackling stone fireplace with glowing flames, soft knit blankets draped nearby, plush rug on wooden floor, warm amber and orange tones throughout. Use warm practical lighting style with firelight creating soft, romantic glow on subjects. Update outfits only to fit a cozy festive Christmas look (chunky knit sweaters, comfortable loungewear, soft fabrics) while keeping overall realism. Maintain the original camera angle and composition. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 12,
        tags: ["couple", "couple / duo", "cozy", "fireplace", "landscape"],
        scene: "fireplace",
        textDefault: "Cozy Christmas",
      },
      {
        title: "Choosing the Star",
        category: "Cozy",
        subCategory: "Family / Group",
        type: "photo",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/ab570f87-58fd-42d0-8116-94bf43f89ec4",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Choosing the Star' Cozy Christmas template. Replace the background with: Warm living room scene with decorated Christmas tree, parents lifting child to place golden star on top of tree, joyful candid family moment captured. Background shows softly lit room with tree lights twinkling, cozy home atmosphere with warm wood tones and festive decorations. Use warm practical lighting style with soft glow from tree lights and ambient room lighting. Update outfits only to fit a cozy festive Christmas look (comfortable knit sweaters, casual holiday attire) while keeping overall realism. Maintain the original camera angle and composition. Capture expressions of joy, excitement, and family connection. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 24,
        tags: ["cozy", "family / group", "portrait", "tree"],
        scene: "tree",
        textDefault: "Magic Moments",
      },
      {
        title: "Story Time",
        category: "Cozy",
        subCategory: "Family / Group",
        type: "photo",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/434360a0-6206-4438-8471-8ace10f35578",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Story Time' Cozy Christmas template. Replace the background with: Intimate family scene with parent reading Christmas storybook to children gathered by warm crackling fireplace, cozy living room setting with soft blankets and pillows, gentle rim light creating magical atmosphere. Background shows glowing fireplace, comfortable seating area, subtle Christmas decorations with lighting and luxury decoration, warm wood elements. Use warm practical lighting style with firelight as main source creating soft golden glow and gentle rim lighting on subjects. Update outfits only to fit a cozy festive Christmas look (soft knit sweaters, comfortable pajamas, warm loungewear) while keeping overall realism. Maintain the original camera angle and composition. Capture peaceful, intimate family moment with focus and engagement on storytelling. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 24,
        tags: ["cozy", "family / group", "fireplace", "landscape"],
        scene: "fireplace",
        textDefault: "Story Time",
      },
      {
        title: "Sweater Weather",
        category: "Cozy",
        subCategory: "Couple / Duo",
        type: "image",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/71c13f0e-1b33-410b-98ae-bea8ac41c5f3",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Sweater Weather' Cozy Christmas template. Replace the background with: Romantic intimate scene of couple wrapped together under soft cozy blanket near warm fireplace with glowing embers gently floating in air, decorated Christmas tree with twinkling lights visible in background creating magical ambiance, dim cozy living room with soft bokeh lights from tree ornaments and string lights, stockings hung by fireplace, pine garlands with red berries on mantel, festive holiday decorations throughout. Use warm practical lighting style with firelight and Christmas lights creating golden-orange tones, gentle side lighting highlighting subjects softly. Update outfits only to fit a cozy festive Christmas look (chunky knit sweaters in holiday colors, comfortable layered clothing, warm textures) while keeping overall realism. Maintain the original camera angle and composition. Capture intimate, peaceful Christmas moment with romantic, relaxed holiday atmosphere. The scene should feel warm, dreamy, and tender with soft focus on background elements. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 8,
        tags: ["couple", "couple / duo", "cozy", "portrait", "image"],
        scene: "fireplace",
        textDefault: "Cozy Christmas",
      },
      {
        title: "Snowman Builders",
        category: "Snowy",
        subCategory: "Family / Group",
        type: "image",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/cfd0f1c2-5ec7-4562-81e5-3782d35aa919",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, and all physical characteristics of every uploaded person without ANY changes. Face preservation is the absolute priority. \nShow uploaded people building a snowman together in fresh snow outdoors during daytime. Background: gentle snowfall, snow-covered evergreen trees, soft natural winter light. Snowman is partially built with coal buttons, carrot nose, and stick arms nearby. People wear colorful winter coats, scarves, knitted hats, and gloves, actively rolling snowballs or decorating snowman. Happy, playful expressions. Cool blue-white winter atmosphere with colorful clothing accents. 8K quality, vibrant colors, crisp focus. \nREMINDER: Keep all uploaded faces and bodies completely unchanged.",
        creditCost: 24,
        tags: ["family", "family / group", "landscape", "snow", "snowy"],
        scene: "outdoor",
        textDefault: "Winter Fun",
      },
      {
        title: "Sledding Hill",
        category: "Snowy",
        subCategory: "Couple / Duo",
        type: "photo",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/39c7cc1a-40df-4718-9dea-9ef4dcb89346",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Sledding Hill' Snowy Christmas template. Replace the background with: Dynamic winter scene on snowy hillside slope with people on sleds captured mid-descent, pristine white snow covering rolling hills, snow-covered evergreen trees lining the slope, dramatic golden-hour sunset sky with pink and orange hues painting clouds, motion blur effect on snow spray and sled movement creating sense of speed and excitement, crisp winter air atmosphere with visible breath vapor, snow particles kicked up during sledding. Use natural ambient lighting style with warm sunset glow illuminating subjects from side, golden light creating long shadows on snow, cool blue tones in shadowed snow areas contrasting with warm sunset colors. Update outfits only to fit a festive snowy Christmas look (bright colorful winter coats, knit scarves, warm hats with pom-poms, insulated snow pants, winter gloves) while keeping overall realism. Maintain the original camera angle and composition. Capture joyful, exhilarating moment of winter fun with dynamic energy and movement. The scene should feel crisp, magical, and full of holiday adventure with professional action photography quality. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 24,
        tags: ["couple / duo", "landscape", "snowy"],
        scene: "outdoor",
        textDefault: "Winter Adventure",
      },
      {
        title: "Snowfall Portrait",
        category: "Snowy",
        subCategory: "Single Portrait",
        type: "photo",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/5424576f-77cf-4820-8911-87c200c96c99",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Snowfall Portrait' Snowy Christmas template. Replace the background with: Elegant winter portrait scene with gentle snowfall, individual snowflakes captured sharply in foreground creating bokeh effect and depth, soft-focused snow-covered evergreen trees in background, serene winter atmosphere with overcast sky providing even diffused lighting, pristine white snow blanket covering ground, peaceful quiet snowfall creating magical holiday ambiance. Use natural ambient lighting style with soft diffused winter daylight, cool blue-white color temperature typical of snowy overcast conditions, gentle highlights on face from reflected snow light, subtle rim lighting from sky. Update outfits only to fit a festive snowy Christmas look (cozy knit beanie or winter hat, warm wool coat or puffer jacket, chunky scarf, layered winter clothing in rich holiday colors) while keeping overall realism. Maintain the original camera angle and composition. Capture serene, contemplative winter portrait with cinematic shallow depth of field focusing on subject while snowflakes create beautiful foreground bokeh. The scene should feel peaceful, elegant, and timelessly festive with professional magazine-quality portrait photography aesthetics. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 12,
        tags: ["portrait", "single portrait", "snowy"],
        scene: "outdoor",
        textDefault: "Winter Wonderland",
      },
      {
        title: "Derdelus",
        category: "Snowy",
        subCategory: "Single Portrait",
        type: "image",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/3630359c-7f8c-40e5-9b6a-1389d9d99204",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Derdelus' Snowy Christmas template. Replace the background with: Immersive POV perspective of exhilarating sled ride through winding snowy forest path, snow-covered pine trees lining both sides creating natural tunnel effect, fresh powder snow on ground with sled tracks visible, gentle motion blur on surrounding trees suggesting movement and speed, subtle camera sway creating dynamic sense of riding experience, snow particles and flakes caught in motion, winter wonderland forest atmosphere with dappled natural light filtering through tree branches, distant holiday cabin or warm lights visible through trees adding festive touch. Use natural ambient lighting style with soft overcast winter daylight, cool blue-white tones in shadowed areas, bright white highlights on snow surfaces, atmospheric perspective creating depth. Update outfits only to fit a festive snowy Christmas look (insulated winter coats in vibrant colors, warm snow pants, thick gloves, cozy winter hats or helmets, scarves) while keeping overall realism. Maintain the original camera angle and composition while incorporating the POV sledding perspective. Capture the thrilling, adventurous energy of winter sledding with cinematic action photography quality, sense of speed and joy. The scene should feel dynamic, immersive, and full of holiday winter excitement with professional sports photography aesthetics. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 9,
        tags: ["landscape", "single portrait", "snow", "snowy", "image"],
        scene: "outdoor",
        textDefault: "Winter Adventure",
      },
      {
        title: "Mistletoe Kiss",
        category: "Romantic",
        subCategory: "Couple / Duo",
        type: "photo",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/2cf3b1b3-e33b-421a-9456-f1a66b65506f",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Mistletoe Kiss' Romantic Christmas template. Replace the background with: Intimate romantic scene of couple sharing tender moment under hanging mistletoe with red berries and green leaves, elegant home interior with decorated Christmas tree softly glowing in background, warm string lights creating bokeh effect, festive garlands with pine branches and red ribbons adorning doorway or archway, cozy living room atmosphere with candles and holiday decorations, soft golden backlight creating dreamy halo effect around couple with subtle lens flare adding magical romance. Use natural ambient lighting style with warm golden-hour quality light, soft backlight illuminating subjects from behind creating gentle rim light on hair and shoulders, lens flare adding ethereal romantic glow, warm color temperature throughout creating intimate atmosphere. Update outfits only to fit a festive romantic Christmas look (elegant knit sweaters, sophisticated holiday dresses, dress shirts, layered winter fashion in deep reds, greens, creams) while keeping overall realism. Maintain the original camera angle and composition. Capture deeply romantic, intimate Christmas moment with cinematic shallow depth of field, professional engagement photography quality. The scene should feel warm, magical, and timeless with soft dreamy aesthetic and authentic emotional connection. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
        creditCost: 24,
        tags: ["couple", "couple / duo", "portrait", "romantic"],
        scene: "tree",
        textDefault: "Love & Joy",
      },
      {
        title: "Sleigh Ride Duo",
        category: "Romantic",
        subCategory: "Couple / Duo",
        type: "photo",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/7b79f88a-6e70-4668-8113-00c9b826ed77",
        prompt:
          "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Sleigh Ride Duo' Romantic Christmas template. Replace the background with: Romantic winter scene of couple sitting together in classic wooden sleigh being pulled by horse team, horses positioned directly in front of sleigh connected by leather harnesses and reins, the sleigh moving forward along snowy forest path, snow-covered evergreen pine trees lining both sides of the trail, fresh snow on ground with sleigh runners creating tracks, gentle snowfall adding magical atmosphere, motion blur on surrounding trees indicating forward movement, wooden sleigh features ornate carvings and red velvet seating, warm plaid blanket covering couple, evergreen garlands with red bows decorating sleigh sides, distant winter landscape with mountains visible through trees, golden sunset light filtering through forest. Use natural ambient lighting style with soft winter daylight, warm golden tones from setting sun, cool blue shadows in snow, gentle romantic glow. The composition must show proper sleigh configuration: horses in front pulling the sleigh from behind them in natural driving position, not separated or beside each other. Update outfits only to fit a festive romantic Christmas look (elegant wool coats, cashmere scarves, vintage winter fashion, rich holiday colors) while keeping overall realism. Maintain the original camera angle and composition. Capture classic romantic sleigh ride with horses properly harnessed and pulling sleigh, professional cinematic quality showing correct historical sleigh ride setup. The scene should feel authentic, elegant, and like a traditional Christmas card with proper horse-drawn sleigh mechanics clearly visible. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged. Ensure horses are positioned in front of and pulling the sleigh in proper driving formation.",
        creditCost: 24,
        tags: ["couple", "couple / duo", "landscape", "romantic", "snow"],
        scene: "outdoor",
        textDefault: "Romantic Christmas",
      },
      {
        title: "Minimal Love Card",
        category: "Romantic",
        subCategory: "Card / No people",
        type: "card",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/de4b859c-2228-4ead-95ea-b82a29a07b15",
        prompt:
          "CRITICAL: If people are present in the uploaded image, preserve their exact facial features, age, hair color, hair style, skin tone, body type, and all physical characteristics without ANY changes. However, integrate them subtly into the card design as secondary elements to the card layout itself. \nEdit the uploaded image into an elegant Christmas greeting card that matches the 'Minimal Love Card' Romantic template. Create a polished minimalist card design with: Clean white or cream background, delicate thin-line heart outline as central decorative element, elegant holly leaves with red berries artistically incorporated into or around the heart design, sophisticated text column space positioned on right side of card with ample room for personalized greeting message, subtle romantic Christmas elements like small snowflakes or stars scattered minimally, refined border or frame in gold, silver, or soft red tones. Use natural ambient lighting style with soft even illumination, clean professional photography aesthetic. The design should prioritize the card layout and decorative elements. If people are in the original image, de-emphasize them or integrate them very subtly as soft background elements or small accent photos, ensuring the card design remains the primary focus. Leave generous clear space for text placement on right column. Keep the overall portrait orientation. The aesthetic should be modern, sophisticated, and minimalist with elegant typography-friendly layout, professional greeting card quality with romantic yet understated Christmas charm. If additional user preferences are provided, apply them to color palette refinements (blush pink, deep red, forest green, metallics), decorative detail adjustments, or text mood enhancement, but do not add complex scenes or additional characters. \nREMINDER: Card layout and text space are the priority. People, if present, should be minimized or artistically integrated without dominating the design.",
        creditCost: 6,
        tags: ["card", "card / no people", "portrait", "romantic"],
        scene: "tree",
        textDefault: "With Love",
      },
      {
        title: "Winter Proposal",
        category: "Romantic",
        subCategory: "Couple / Duo",
        type: "photo",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/601ae84f-73de-40be-80a7-1e545f052177",
        prompt:
          'CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the "Winter Proposal" Romantic Christmas template. Replace the background with: Deeply emotional proposal moment captured in enchanting snow-covered park setting during twilight, pristine white snow blanketing ground and tree branches, elegant fairy lights strung through bare winter trees creating magical twinkling canopy overhead, warm golden glow from string lights contrasting beautifully with cool blue winter atmosphere, gentle snowfall adding romantic ambiance, snow-covered park benches and lamp posts visible, distant city lights or decorated buildings softly glowing in background, footprints in fresh snow leading to proposal spot, perhaps scattered rose petals on snow or small lanterns creating intimate circle. Use natural ambient lighting style with magical blue hour lighting, warm fairy light glow illuminating couple from above creating dreamy bokeh effect, soft reflected light from snow, ethereal twilight sky with deep blue and purple tones, gentle rim lighting on subjects. Update outfits only to fit a festive romantic Christmas look (elegant winter coats, sophisticated scarves, dressy winter attire, perhaps woman in flowing dress with coat, refined winter fashion in jewel tones or classic black and burgundy) while keeping overall realism. Maintain the original camera angle and composition. Capture raw authentic emotion of proposal moment with candid genuine expressions of surprise, joy, love, tears of happiness, professional engagement photography quality with perfect timing. The scene should feel deeply romantic, magical, and once-in-a-lifetime with cinematic movie proposal aesthetics, emotional storytelling, and breathtaking winter wonderland beauty. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged. Preserve authentic emotional expressions.',
        creditCost: 18,
        tags: ["couple / duo", "portrait", "romantic", "snow"],
        scene: "outdoor",
        textDefault: "Forever Yours",
      },
    ];

    // Clear existing templates first (allows re-seeding)
    const existingTemplates = await ctx.db.query("templates").collect();
    for (const template of existingTemplates) {
      await ctx.db.delete(template._id);
    }

    // Insert all templates
    for (const item of items) {
      await ctx.db.insert("templates", item);
    }

    return {
      success: true,
      count: items.length,
      cleared: existingTemplates.length,
    };
  },
});

// Development-only seeding helper: inserts three video templates without requiring admin.
// This is intended for local development only and will not perform any admin checks.
export const devSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const items: TemplateSeed[] = [
      {
        title: "Cozy Fireplace Gathering",
        category: "Cozy",
        subCategory: "Family / Group",
        type: "video",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/efc9e84f-ed1f-47cb-ac2b-606d35b7cc25",
        prompt: `Use the uploaded reference images to extract and preserve the identity, facial features, hairstyle, age, skin tone, and overall appearance of each individual with maximum fidelity. Only the people in the reference images may appear in the video. No additional characters, no altered faces, and no identity drift are allowed. Maintain sharp, clear, well-lit faces throughout the entire sequence.

Identity requirements:
- Preserve each person’s exact facial structure, proportions, skin tone, hair details, and natural expression style.
- No blending, deformation, or smoothing of facial features.
- Faces must remain stable and recognizable from all angles.
- Do not obscure faces with props, shadows, or exaggerated movements.

Scene description:
A warm, intimate Christmas evening setting with only the uploaded individuals sitting comfortably near a crackling stone fireplace. They relax together on a plush rug and a cozy couch, each holding a steaming mug of hot chocolate topped with marshmallows. Light steam rises naturally from the mugs. The atmosphere is calm, joyful, and cinematic.

Action control:
Show subtle, slow, realistic gestures:
- hands warming around mugs  
- gentle head movements  
- soft eye contact or relaxed glances  
- natural breathing  
- light, warm expressions and content smiles  

Avoid any artificial or exaggerated movements. No sudden behavior changes. No automatic action transitions.

Environment:
A stone fireplace emits warm flickering golden light that softly illuminates the individuals’ faces with smooth highlights and gentle shadows. Christmas stockings hang neatly from the mantel. Pine garlands decorated with red berries frame the fireplace. In the softly blurred background, twinkling fairy lights create warm bokeh.

Clothing:
AI-generated cozy knit winter sweaters in tones such as burgundy, cream, and forest green. Clothing must not distort identity or hide the face.

Camera direction:
Cinematic close-up and medium shots with a slow, smooth dolly-in movement. Shallow depth of field keeps faces crisp while the background softly blurs. Motion must be stable, gentle, and consistent.

Lighting:
Warm 2700K firelight as the key source. Soft fill from ambient Christmas tree lights. Balanced exposure that keeps faces clear and well defined without harsh shadows or overexposure.

Style:
Lifestyle documentary-style cinematography with emotional warmth and premium visual quality. Professional warm color grading with rich tones and subtle film grain texture. Smooth cinematic motion similar to a holiday commercial.

Additional instructions:
- Preserve identity only; clothing, environment, and lighting follow the scene description.
- Adapt naturally to 1, 2, or 3 reference individuals, maintaining accurate placement and proportions.
- No extra people under any circumstances.
- Maintain visual consistency of all individuals across the entire video.
- Keep all actions, lighting, and gestures coherent and realistic.
- Faces must stay sharp, stable, and unobstructed at all times.
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/7db4bb2d-2e86-4535-ae8f-98d2a910c25e",
        tags: ["cozy", "family / group", "fireplace", "landscape", "video"],
        scene: "fireplace",
        textDefault: "Warm Holiday Moments",
        defaultDuration: 6,
        defaultAspectRatio: "16:9",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },

      {
        title: "Fireplace Laughter",
        category: "Cozy",
        subCategory: "Family / Group",
        type: "video",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/2d32231d-9403-473f-968b-62485379683e",
        prompt: `Use the uploaded reference images to extract and preserve the identity, facial features, hairstyle, age, skin tone, and overall appearance of each individual with maximum clarity. The video must include only these exact people. No additional characters are allowed. Each face must remain consistently sharp, stable, and recognizable throughout the entire video.

Identity requirements (critical):
- Do not alter age, skin tone, hairstyle, bone structure, or natural expression style.
- No face blending, smoothing, distortion, or morphing.
- Faces must remain well-lit, clear, unobstructed, and never lost in shadow.
- Maintain identity fidelity with no changes during motion or angle shifts.

Scene description:
A heartwarming wide-to-medium shot of only the people in the uploaded reference images gathered cozily near a stone fireplace during a warm Christmas evening. They interact naturally with each other—sharing gentle laughter, exchanging smiles, and enjoying intimate conversation. Show authentic human connection: soft head tilts, expressive hand gestures, warm eye contact, and relaxed leaning or closeness between individuals.

Fireplace environment:
A crackling stone fireplace emits warm golden light that flickers softly across the scene, creating depth and cinematic atmosphere. A Christmas tree with soft white lights appears in the background with a gentle glow, slightly out of focus for bokeh effect. Stockings hang neatly from the mantel alongside pine garlands, natural green foliage, and rich burgundy ribbons—forming a classic Christmas ambiance.

Action control (strict):
- Movements must be slow, natural, and physically consistent.
- No abrupt transitions, no automatic changes in activity.
- No invented actions, no props appearing unless described.
- Hands must not merge into bodies, fireplace, or environment.
- Keep actions simple: laughter, gestures, storytelling, eye contact.

Cinematic direction:
A slow and subtle gentle push-in camera movement emphasizes intimacy. Use shallow depth of field to keep the individuals and their faces in crisp focus while the background softly blurs. Maintain smooth, stable motion with zero jitter or sudden reframing.

Lighting:
Warm fireplace practical light as the key source (~2700K), softly illuminating faces with gentle highlights and warm shadows. Christmas lights act as subtle fill and accent light. Include a delicate warm rim light that defines outlines without overpowering the scene.

Clothing:
AI-generated festive casual winter clothing such as chunky knit sweaters, cozy textures, and holiday-appropriate outfits in rich jewel tones — but identity must remain the same. Clothing should not block or distort facial identity.

Style:
High-end lifestyle cinematography with emotional storytelling. Professional warm color grading. Smooth cinematic motion similar to premium holiday commercial aesthetics. Keep expressions genuine and natural — real smiles, soft eye movements, subtle breathing.

Additional instructions:
- Preserve identity only; background, clothing, lighting, and environment follow the scene description.
- Maintain accurate proportion and placement for 1, 2, or 3 uploaded individuals.
- No additional characters or background people.
- Keep faces clear, sharp, and never occluded by hair, hands, shadows, or props.
- Ensure visual consistency across the entire video with no identity drift.
- Avoid any dramatic changes, exaggerated gestures, or unpredictable behavior.
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/4d3c2ab0-2676-4345-994e-05b3b7d44d74",
        tags: ["cozy", "family / group", "fireplace", "landscape", "video"],
        scene: "fireplace",
        textDefault: "Joyful Together",
        defaultDuration: 6,
        defaultAspectRatio: "16:9",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },
      {
        title: "Snowman Builders",
        category: "Snowy",
        subCategory: "Family / Group",
        type: "video",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/e559f884-3fc4-4d97-be6c-a5b362991a4b",
        prompt: `Use the uploaded reference images to extract and preserve the identity, facial features, hairstyle, age, skin tone, and overall appearance of each individual with maximum clarity. The video must include only these exact people, with no additional characters added. The face of each person must remain consistently sharp, stable, and clearly recognizable throughout the entire video.
Identity requirements (very important):
- Do not alter age, facial structure, skin tone, or hairstyle.
- Do not blend faces or smooth them out; maintain crisp identity details.
- Faces must remain fully visible, unobstructed, and not distorted by snow, motion, or transitions.
- No morphing, no automatic camera-cut transitions, and no changes to identity at any moment.

Scene description:
Medium shot of only the people in the uploaded reference images collaborating together to build a snowman in a winter landscape. Show realistic and controlled actions: gently rolling large snowballs, lifting and placing sections, patting the snow to smooth the surface, and carefully adjusting details. Actions must be natural, stable, and physically coherent.

Important action control:
- No automatic transitions or sudden changes in activity.
- Do not jump ahead in the process.
- The carrot nose, eyes, and stick arms should appear ONLY when placed in the moment, not earlier.
- No merging of hands with the snowman; maintain clean separation between hands and snow.
- Movements must be smooth, slow, intentional, and continuous.

Visual environment:
A bright snowy landscape with soft snowfall, snow-covered trees in the background, and even cinematic winter daylight. Clothing should be winter-appropriate, colorful, and coordinated, but identity must remain the same. Keep the faces well-lit and clearly visible at all times.

Cinematic requirements:
- Smooth, slow, stable camera movement (no cuts, no jumps).
- Medium depth of field to keep faces sharp.
- Realistic breathing, natural gestures, and consistent proportions.
- No extra people, no crowds, no additional characters in the background.

Additional instructions:
- Preserve identity only; background, clothing, and lighting are generated according to the scene description.
- Maintain consistent placement and proportion for 1, 2, or 3 uploaded individuals.
- The video must not introduce new elements, new characters, or new actions.
- Keep faces front-facing or at natural angles where identity remains fully recognizable.
- Avoid hand, snow, or body deformation during interaction.
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/1c0d147a-467d-43a8-97d1-725b7089818b",
        tags: ["snowy", "family / group", "landscape", "winter", "video"],
        scene: "outdoor",
        textDefault: "Winter Fun",
        defaultDuration: 6,
        defaultAspectRatio: "16:9",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },

      {
        title: "Snow Angels",
        category: "Snowy",
        subCategory: "Family / Group",
        type: "video",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/91ee572b-b72c-4135-aade-9e87d3c46c5c",
        prompt: `Use the uploaded reference images to extract and preserve the exact identity of each individual with maximum accuracy. Maintain their real facial features, proportions, hair characteristics, age, skin tone, and overall appearance exactly as shown in the reference images. Only the individuals from the reference images may appear in the video. Absolutely no additional characters, no altered faces, and no identity drift are allowed.

Identity stability:
- Keep all faces sharp, well-lit, and fully recognizable throughout.
- Preserve each person’s natural facial expression style.
- No warping, smoothing, blending, or de-aging.
- No obscured faces—ensure upward-facing visibility remains clear.

Scene description:
A magical winter scene filmed from an overhead aerial perspective, looking directly down at only the uploaded individuals lying in pristine, untouched fresh snow while joyfully creating snow angels. The snow surface is clean and bright, forming a perfect natural canvas.

Action control:
Show smooth, natural, rhythmic snow-angel motions:
- arms sweeping outward from hips to overhead  
- legs spreading outward and then closing  
- gentle, coordinated movement  
- consistent motion without abrupt transitions  

Faces should show joyful expressions as they look upward toward the sky/camera. Breathing should be subtle and natural, with occasional soft visible vapor. No actions should change or transition unexpectedly.

Environment:
Fresh, untouched snow beneath the individuals with soft texture. Snow angel impressions must form clearly and accurately in real-time with each sweeping motion. Light gentle snowfall drifts downward, creating soft foreground bokeh and enhancing the overhead perspective. Surrounding area is an open snow field with distant snow-covered trees along the horizon.

Clothing:
AI-generated vibrant winter coats in rich contrasting colors such as red, royal blue, and bright purple that stand out against the white snow. Clothing must not obscure faces or interfere with identity clarity.

Camera direction:
Overhead camera positioned directly above subjects. Composition should show full body and complete symmetrical snow-angel formations. Camera movement should be minimal, subtle, and cinematic—such as a slow, smooth rise, gentle descent, or slight rotation to enhance perspective while maintaining stability.

Lighting:
Bright overcast winter daylight provides soft, even illumination. Snow acts as a natural reflector, casting clean diffused light upward onto faces for flattering clarity. White balance should reflect cool winter daylight.

Style:
Whimsical lifestyle cinematography with crisp focus, vibrant color saturation, and strong contrast between subjects and snow. Magical winter atmosphere enhanced by falling snow, clean compositions, and rhythmic motion. Professional cinematic quality with smooth, stable movement.

Additional instructions:
- Preserve identity only; clothing, background, and lighting are defined by the scene description.
- Adapt naturally to 1, 2, or 3 reference individuals while maintaining accurate proportions and spatial placement.
- No extra people under any circumstances.
- Ensure consistent appearance, lighting, and facial clarity for all individuals across the entire video.
- Motion must remain steady, realistic, and visually coherent with no abrupt shifts or unwanted behaviors.
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/d7b42be8-730c-4e67-8ec1-b00cc1d25da0",
        tags: ["snowy", "family / group", "portrait", "winter", "video"],
        scene: "outdoor",
        textDefault: "Snow Day Magic",
        defaultDuration: 6,
        defaultAspectRatio: "9:16",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },
      {
        title: "Tree Decorating Magic",
        category: "Classic",
        subCategory: "Family / Group",
        type: "video",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/c5dcbc25-f5e2-4bcd-ac3c-00a352e5cddd",
        prompt: `Use the uploaded reference images to extract and preserve the exact identity of each individual with maximum fidelity. Maintain their real facial structure, proportions, hairstyle, age, skin tone, and unique appearance exactly as shown. Only the individuals in the reference images may appear. No additional characters or altered faces are allowed.

Identity stability:
- Keep faces sharp, clear, well-lit, and recognizable at all times.
- No warping, blending, smoothing, or face drift.
- Preserve their natural look and expression style while maintaining cinematic consistency.
- Do not obscure faces with camera angles, ornaments, shadows, or tree branches.

Scene description:
A warm, elegant Christmas evening scene where only the uploaded individuals decorate a majestic Christmas tree together in a beautifully appointed living room. The mood is cozy, festive, and cinematic.

Action control:
Show natural, collaborative decorating motions:
- hands gently hanging ornaments  
- placing baubles and ribbons  
- stringing lights along branches  
- reaching upward toward higher branches  
- passing ornaments to one another  
- stepping back briefly to evaluate placement  
- subtle, realistic gestures and soft expressions  

Movements must be smooth, intentional, and consistent, with no abrupt behavior changes or automatic transitions.

Environment:
A tall, richly green Christmas tree stands prominently in the room. Branches catch warm interior lighting, creating depth and sparkle. The room features tasteful holiday décor: fireplace in the background, pine garlands, candles, and elegant seasonal accents. Evening ambiance enhances the cozy warm styling.

Clothing:
AI-generated holiday attire inspired by festive elegance—knit sweaters or soft winter clothing in burgundy, forest green, cream, or muted seasonal jewel tones. Clothing must never obscure identity.

Camera direction:
A graceful cinematic medium-wide shot with slow circular dolly movement around the tree, capturing a 180-degree perspective. Subtle crane motion from slightly low to slightly high accentuates tree height and creates a dynamic visual layer. Keep motion smooth, stable, and slow.

Lighting:
Warm interior lighting around 2700K reflecting a cozy evening environment. Christmas tree lights gradually brighten as they are tested and activated, creating subtle starburst reflections on ornaments. Soft window light from outside adds a mild cool contrast for realism. Ensure faces remain evenly lit, visible, and clear throughout.

Style:
Upscale lifestyle cinematography with rich warm color grading, controlled highlights, and smooth cinematic motion. Medium depth of field keeps subjects and tree sharp while the background softly blends. Reflections on ornaments should shimmer naturally with high-quality detail.

Additional instructions:
- Preserve identity only; environment, clothing, and lighting follow the scene description.
- Adapt cleanly to 1, 2, or 3 reference individuals while maintaining correct proportions and natural interaction.
- No extra people under any circumstances.
- Maintain facial consistency, lighting consistency, and stable identity across the entire video.
- Keep all gestures and actions realistic, coherent, and aligned with the decorating process.
- No unwanted pose changes, random actions, or character inconsistencies.
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/1f2751f9-3555-4a0e-9f37-5dba2eb78c3d",
        tags: ["classic", "family / group", "portrait", "tree", "video"],
        scene: "tree",
        textDefault: "Deck The Halls",
        defaultDuration: 6,
        defaultAspectRatio: "9:16",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },
      {
        title: "Mistletoe Kiss",
        category: "Romantic",
        subCategory: "Couple / Duo",
        type: "video",
        orientation: "portrait",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/e94f3df7-8553-4089-822b-b5a190b83ed1",
        prompt: `Use the uploaded reference images to extract and preserve the exact identity, facial features, hairstyle, age, skin tone, and overall appearance of each individual with maximum accuracy. Only the people in the reference images may appear. No additional characters, no altered faces, and no identity drift are allowed.

Identity stability:
- Maintain sharp, clear, well-lit facial details at all times.
- Preserve their natural appearance and expression style without smoothing, warping, or blending.
- Keep both faces unobstructed, with consistent proportions and stable identity from every angle.

Scene description:
A warm, cinematic romantic moment where the two uploaded individuals share a tender holiday kiss beneath a hanging mistletoe. The environment is soft, glowing, and emotionally intimate, capturing a timeless Christmas romance.

Action control:
Show a natural sequence of romantic gestures:
- couple approaches each other with warm expressions  
- they gently look upward to notice the mistletoe  
- exchange loving glances  
- lean in slowly for a soft, tender kiss  
- natural eye closing during the kiss  
- subtle hands touching face, gentle embrace, relaxed body language  

Movements must remain smooth, stable, and realistic, with no abrupt or exaggerated transitions.

Environment:
Mistletoe with green leaves and red berries hangs naturally from a doorway or archway decorated with pine garland and a red ribbon. Behind them, a softly glowing Christmas tree emits warm golden lights. Background bokeh should create a dreamy, romantic atmosphere.

Clothing:
AI-generated elegant holiday attire—such as a sophisticated dress or dressy sweater for the woman, and a fine-knit sweater or button-down shirt for the man. Colors include deep jewel tones: burgundy, emerald, navy. Clothing should complement the scene without obscuring facial identity.

Camera direction:
Cinematic romantic close-up with a gentle slow push-in as the couple approaches. Camera holds steady during the kiss, with a subtle upward tilt following their gaze toward the mistletoe before they lean in. Motion is soft, smooth, and highly controlled.

Lighting:
Warm golden lighting around 2700K creating a romantic mood. Soft golden backlight forms a gentle halo around their hair and shoulders, with subtle lens flare adding a magical holiday touch. Key light on faces must remain soft and flattering. Background tree lights create creamy bokeh.

Style:
Luxury romance cinematography with film-like softness, warm rich color grading, subtle diffusion, and shallow depth of field. Emphasize emotional authenticity, gentle movement, and high-end holiday aesthetics.

Additional instructions:
- Preserve identity only; clothing, background, and lighting are defined by the scene description.
- For two uploaded individuals, maintain accurate positioning and intimate interaction.
- No extra people under any circumstances.
- Keep faces fully visible and consistently recognizable throughout.
- Ensure motion is coherent, intimate, and emotionally natural.
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/296fbd99-db41-46e4-b1b5-45842cbd728c",
        tags: ["romantic", "couple / duo", "portrait", "mistletoe", "video"],
        scene: "tree",
        textDefault: "Love & Joy",
        defaultDuration: 6,
        defaultAspectRatio: "4:5",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },

      {
        title: "Festive Dinner Table",
        category: "Romantic",
        subCategory: "Family / Group",
        type: "video",
        orientation: "landscape",
        previewUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/222518b1-b43a-4a07-8e2e-bdf212c37a50",
        prompt: `Use the uploaded reference images to extract and preserve the exact facial identity, expressions, age, hairstyle, and physical appearance of each adult exactly as shown. Only the individuals in the reference images may appear. No additional people, no identity drift, no facial changes, and no alterations to their appearance at any point.

Identity stability requirements:
- Maintain consistent, sharp, well-lit facial features no matter the angle.
- Preserve natural expressions, eye shapes, and proportional details.
- Faces may turn naturally while staying fully recognizable.
- No smoothing, warping, or blending between frames.

Scene overview:
A warm, elegant Christmas dinner gathering in a beautifully lit dining room. Begin with a wide establishing shot of all adults seated around an exquisitely prepared holiday dinner table, transitioning into medium shots during natural conversation. The emotional tone is warm, joyful, and sincere.

Table & props (STRICT continuity rules):
The table is elegantly set with:
- white linen tablecloth  
- fine bone china  
- polished silverware  
- crystal wine glasses (each filled with red wine)  
- cloth napkins folded neatly  
- festive centerpiece of fresh pine branches, red holly berries, white pillar candles at multiple heights, and scattered gold ornaments  

A golden roasted turkey sits as the main centerpiece dish, surrounded by classic holiday sides in refined serving platters.  
All props remain perfectly consistent with NO changes:
- wine glasses never transform, disappear, change color, or become another object  
- silverware stays on the table  
- no bottles appear in hands  
- food remains visually stable  
- candles do not change height or position  

Character action & movement:
Adults engage in subtle, natural dinner-table behavior:
- relaxed conversation  
- gentle head tilts  
- soft laughter  
- mild expressive gestures while keeping one hand on their crystal wine glass  
- occasional warm glances exchanged across the table  

At the key emotional moment, all adults simultaneously perform a coordinated toast:
- each raises their crystal wine glass  
- glasses meet in the center above the table  
- glasses return smoothly to their original position afterward  

Movements must stay controlled, stable, and realistic. No exaggerated gestures or rapid motion.

Clothing:
AI-generated but aligned with the upscale holiday theme.  
Women wear elegant holiday dresses or dressy blouses in jewel tones.  
Men wear button-down shirts or fine-knit sweaters.  
Color palette: burgundy, emerald green, navy, gold accents.  
Clothing must remain stable and consistent through the entire sequence.

Camera direction:
A slow, refined lateral dolly shot tracking along the length of the table from left to right at consistent eye-level.  
No sudden angle changes, no jumps, no cuts.  
Camera glides smoothly, transitioning naturally from the wide establishing view into medium conversational shots.

Lighting:
Warm candlelight is the dominant source at around 2400K, providing soft flicker and amber glow across faces.  
Supplemented by:
- soft, warm overhead chandelier lighting  
- gentle twilight window fill for subtle depth  
The lighting creates dimensionality without harsh shadows, preserving flattering skin tones and rich golden warmth.

Background & environment:
Decorated dining room with:
- fresh garland along walls  
- warm string lights  
- soft ambient Christmas décor  
- partial view of a lit Christmas tree through a doorway or adjacent room  

Depth of field:
Medium depth of field keeping diners and table elements sharp while the background falls into elegant soft defocus.

Cinematic style:
Luxury lifestyle editorial cinematography with:
- smooth 24fps motion  
- film-like grain  
- warm golden/amber color grading  
- consistent exposure  
- no visual artifacts, no jerky transitions  
- grounded, authentic emotional warmth  

Special requirements:
- Maintain perfect prop continuity—no object morphing or swapping.  
- Maintain perfect facial identity.  
- Keep wine glasses stable, never replaced or altered.  
- Keep scene absolutely consistent in lighting, environment, and attire.  
`,
        creditCost: 6,
        thumbnailUrl:
          "https://giddy-swan-737.convex.cloud/api/storage/81f283a8-1722-4d2e-afdf-98e0d00efc6e",
        tags: ["romantic", "family / group", "landscape", "dinner", "video"],
        scene: "table",
        textDefault: "Holiday Feast",
        defaultDuration: 8,
        defaultAspectRatio: "16:9",
        defaultResolution: "1080p",
        generateAudioDefault: true,
      },
    ];

    // Insert items (do not clear existing templates to avoid accidental deletion)
    const inserted: Array<{ title: string; id: any }> = [];
    const errors: Array<{ title: string; error: string }> = [];

    for (const item of items) {
      try {
        const id = await ctx.db.insert("templates", item);
        inserted.push({ title: item.title, id });
      } catch (err: any) {
        errors.push({ title: item.title, error: String(err) });
      }
    }

    return {
      success: true,
      marker: "devSeed-patched-v2",
      count: items.length,
      inserted: inserted.length,
      insertedItems: inserted,
      errors,
    };
  },
});

// export const devImageTempSeed = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const items: TemplateSeed[] = [
//       {
//         title: "Gift Unwrapping Moment",
//         category: "Classic",
//         subCategory: "Family",
//         type: "image",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/32d88747-c256-4285-9edb-9b4a6d0a77d7",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, and all physical characteristics of every uploaded person without ANY changes. Face preservation is the absolute priority. \nShow uploaded people unwrapping Christmas gifts together in a warm living room during evening.Background elements: decorated Christmas tree with golden ornaments and white lights, stone fireplace with stockings, wrapped presents in red and gold paper on floor, pine garlands on mantel with candles.Soft string lights on walls, plush rugs, comfortable furniture.Warm 2700K lighting creates cozy glow.People wear casual sweaters or pajamas, showing genuine joy and excitement with wrapping paper around them.Candid moment, shallow depth of field, 8K quality, warm natural tones. \nREMINDER: Keep all uploaded faces and bodies completely unchanged.",
//         creditCost: 10,
//         tags: [
//           "classic",
//           "family",
//           "portrait",
//           "tree",
//           "evening",
//           "elegant",
//           "luxury",
//         ],
//         scene: "tree",
//         textDefault: "Merry Christmas!",
//       },
//       {
//         title: "Grand Evergreen Portrait",
//         category: "Classic",
//         subCategory: "Couple / Duo",
//         type: "photo",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/5d2d4c32-8193-4763-b136-2e7a8d950f96",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Grand Evergreen Portrait' Classic Christmas template. Replace the background with: Classic Christmas tree with ornaments and warm bokeh lights in an elegant living room. Use warm practical lighting style. Update outfits only to fit a festive classic Christmas look (sweaters, coats, dresses) while keeping overall realism. Maintain the original camera angle and composition. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or with preserving the subjects. \n REMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 12,
//         tags: ["classic", "couple / duo", "portrait", "tree"],
//         scene: "tree",
//         textDefault: "Season's Greetings",
//       },
//       {
//         title: "Festive Dinner Table",
//         category: "Classic",
//         subCategory: "Couple / Dou",
//         type: "photo",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/832ce66a-423b-4d1a-96a2-d0aa52438d1f",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Do not add any new people or faces to the scene. \nEdit the uploaded photo to match the 'Festive Dinner Table' Classic Christmas template. Replace the environment with: Candle-lit elegant dinner table setting with crystal glasses, fine china, red and green festive accents, Christmas centerpiece with pine branches and ornaments. Use warm practical lighting style with soft candlelight glow creating intimate atmosphere. Keep the general framing and orientation of the original photo. Apply shallow depth of field focusing on the subjects. If additional user preferences are provided, apply them only to atmosphere, colors, and small decorative elements without conflicting with the template or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged. Do not add new people.",
//         creditCost: 24,
//         tags: ["candle", "classic", "landscape", "scene / no people", "table"],
//         scene: "table",
//         textDefault: "Warm Wishes",
//       },
//       {
//         title: "Red & Gold Card",
//         category: "Classic",
//         subCategory: "Card / No people",
//         type: "card",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/8f9799ba-b25a-4b57-8799-03c12946a43f",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. \n Edit the uploaded image into a polished Christmas greeting card that matches the 'Red & Gold Card' template. Create a clean card layout with: Minimal red and gold decorative border, elegant snowflake accents in corners, ample clear space for greeting text placement. Use warm practical lighting style creating festive glow. Keep uploaded people visible and unchanged while integrating them into the card design. Maintain the overall orientation and composition of the original photo. Apply professional greeting card styling with festive red-gold color palette. If additional user preferences are provided, apply them only to color palette variations, decorative details, or text mood without conflicting with the template design or subject preservation. \n REMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged in the final card design.",
//         creditCost: 6,
//         tags: [
//           "card",
//           "card / no people",
//           "classic",
//           "minimal",
//           "portrait",
//           "snow",
//         ],
//         scene: "tree",
//         textDefault: "Merry Christmas!",
//       },
//       {
//         title: "By the Hearth",
//         category: "Cozy",
//         subCategory: "Couple / Duo",
//         type: "photo",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/34d7ef5e-5ecd-4ada-b3d8-93349d9d8076",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'By the Hearth' Cozy Christmas template. Replace the background with: Intimate scene near a crackling stone fireplace with glowing flames, soft knit blankets draped nearby, plush rug on wooden floor, warm amber and orange tones throughout. Use warm practical lighting style with firelight creating soft, romantic glow on subjects. Update outfits only to fit a cozy festive Christmas look (chunky knit sweaters, comfortable loungewear, soft fabrics) while keeping overall realism. Maintain the original camera angle and composition. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 12,
//         tags: ["couple", "couple / duo", "cozy", "fireplace", "landscape"],
//         scene: "fireplace",
//         textDefault: "Cozy Christmas",
//       },
//       {
//         title: "Choosing the Star",
//         category: "Cozy",
//         subCategory: "Family / Group",
//         type: "photo",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/ab570f87-58fd-42d0-8116-94bf43f89ec4",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Choosing the Star' Cozy Christmas template. Replace the background with: Warm living room scene with decorated Christmas tree, parents lifting child to place golden star on top of tree, joyful candid family moment captured. Background shows softly lit room with tree lights twinkling, cozy home atmosphere with warm wood tones and festive decorations. Use warm practical lighting style with soft glow from tree lights and ambient room lighting. Update outfits only to fit a cozy festive Christmas look (comfortable knit sweaters, casual holiday attire) while keeping overall realism. Maintain the original camera angle and composition. Capture expressions of joy, excitement, and family connection. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 24,
//         tags: ["cozy", "family / group", "portrait", "tree"],
//         scene: "tree",
//         textDefault: "Magic Moments",
//       },
//       {
//         title: "Story Time",
//         category: "Cozy",
//         subCategory: "Family / Group",
//         type: "photo",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/434360a0-6206-4438-8471-8ace10f35578",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Story Time' Cozy Christmas template. Replace the background with: Intimate family scene with parent reading Christmas storybook to children gathered by warm crackling fireplace, cozy living room setting with soft blankets and pillows, gentle rim light creating magical atmosphere. Background shows glowing fireplace, comfortable seating area, subtle Christmas decorations with lighting and luxury decoration, warm wood elements. Use warm practical lighting style with firelight as main source creating soft golden glow and gentle rim lighting on subjects. Update outfits only to fit a cozy festive Christmas look (soft knit sweaters, comfortable pajamas, warm loungewear) while keeping overall realism. Maintain the original camera angle and composition. Capture peaceful, intimate family moment with focus and engagement on storytelling. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 24,
//         tags: ["cozy", "family / group", "fireplace", "landscape"],
//         scene: "fireplace",
//         textDefault: "Story Time",
//       },
//       {
//         title: "Sweater Weather",
//         category: "Cozy",
//         subCategory: "Couple / Duo",
//         type: "image",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/71c13f0e-1b33-410b-98ae-bea8ac41c5f3",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Sweater Weather' Cozy Christmas template. Replace the background with: Romantic intimate scene of couple wrapped together under soft cozy blanket near warm fireplace with glowing embers gently floating in air, decorated Christmas tree with twinkling lights visible in background creating magical ambiance, dim cozy living room with soft bokeh lights from tree ornaments and string lights, stockings hung by fireplace, pine garlands with red berries on mantel, festive holiday decorations throughout. Use warm practical lighting style with firelight and Christmas lights creating golden-orange tones, gentle side lighting highlighting subjects softly. Update outfits only to fit a cozy festive Christmas look (chunky knit sweaters in holiday colors, comfortable layered clothing, warm textures) while keeping overall realism. Maintain the original camera angle and composition. Capture intimate, peaceful Christmas moment with romantic, relaxed holiday atmosphere. The scene should feel warm, dreamy, and tender with soft focus on background elements. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 8,
//         tags: ["couple", "couple / duo", "cozy", "portrait", "image"],
//         scene: "fireplace",
//         textDefault: "Cozy Christmas",
//       },
//       {
//         title: "Snowman Builders",
//         category: "Snowy",
//         subCategory: "Family / Group",
//         type: "image",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/cfd0f1c2-5ec7-4562-81e5-3782d35aa919",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, and all physical characteristics of every uploaded person without ANY changes. Face preservation is the absolute priority. \nShow uploaded people building a snowman together in fresh snow outdoors during daytime. Background: gentle snowfall, snow-covered evergreen trees, soft natural winter light. Snowman is partially built with coal buttons, carrot nose, and stick arms nearby. People wear colorful winter coats, scarves, knitted hats, and gloves, actively rolling snowballs or decorating snowman. Happy, playful expressions. Cool blue-white winter atmosphere with colorful clothing accents. 8K quality, vibrant colors, crisp focus. \nREMINDER: Keep all uploaded faces and bodies completely unchanged.",
//         creditCost: 24,
//         tags: ["family", "family / group", "landscape", "snow", "snowy"],
//         scene: "outdoor",
//         textDefault: "Winter Fun",
//       },
//       {
//         title: "Sledding Hill",
//         category: "Snowy",
//         subCategory: "Couple / Duo",
//         type: "photo",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/39c7cc1a-40df-4718-9dea-9ef4dcb89346",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Sledding Hill' Snowy Christmas template. Replace the background with: Dynamic winter scene on snowy hillside slope with people on sleds captured mid-descent, pristine white snow covering rolling hills, snow-covered evergreen trees lining the slope, dramatic golden-hour sunset sky with pink and orange hues painting clouds, motion blur effect on snow spray and sled movement creating sense of speed and excitement, crisp winter air atmosphere with visible breath vapor, snow particles kicked up during sledding. Use natural ambient lighting style with warm sunset glow illuminating subjects from side, golden light creating long shadows on snow, cool blue tones in shadowed snow areas contrasting with warm sunset colors. Update outfits only to fit a festive snowy Christmas look (bright colorful winter coats, knit scarves, warm hats with pom-poms, insulated snow pants, winter gloves) while keeping overall realism. Maintain the original camera angle and composition. Capture joyful, exhilarating moment of winter fun with dynamic energy and movement. The scene should feel crisp, magical, and full of holiday adventure with professional action photography quality. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 24,
//         tags: ["couple / duo", "landscape", "snowy"],
//         scene: "outdoor",
//         textDefault: "Winter Adventure",
//       },
//       {
//         title: "Snowfall Portrait",
//         category: "Snowy",
//         subCategory: "Single Portrait",
//         type: "photo",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/5424576f-77cf-4820-8911-87c200c96c99",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Snowfall Portrait' Snowy Christmas template. Replace the background with: Elegant winter portrait scene with gentle snowfall, individual snowflakes captured sharply in foreground creating bokeh effect and depth, soft-focused snow-covered evergreen trees in background, serene winter atmosphere with overcast sky providing even diffused lighting, pristine white snow blanket covering ground, peaceful quiet snowfall creating magical holiday ambiance. Use natural ambient lighting style with soft diffused winter daylight, cool blue-white color temperature typical of snowy overcast conditions, gentle highlights on face from reflected snow light, subtle rim lighting from sky. Update outfits only to fit a festive snowy Christmas look (cozy knit beanie or winter hat, warm wool coat or puffer jacket, chunky scarf, layered winter clothing in rich holiday colors) while keeping overall realism. Maintain the original camera angle and composition. Capture serene, contemplative winter portrait with cinematic shallow depth of field focusing on subject while snowflakes create beautiful foreground bokeh. The scene should feel peaceful, elegant, and timelessly festive with professional magazine-quality portrait photography aesthetics. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 12,
//         tags: ["portrait", "single portrait", "snowy"],
//         scene: "outdoor",
//         textDefault: "Winter Wonderland",
//       },
//       {
//         title: "Derdelus",
//         category: "Snowy",
//         subCategory: "Single Portrait",
//         type: "image",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/3630359c-7f8c-40e5-9b6a-1389d9d99204",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Derdelus' Snowy Christmas template. Replace the background with: Immersive POV perspective of exhilarating sled ride through winding snowy forest path, snow-covered pine trees lining both sides creating natural tunnel effect, fresh powder snow on ground with sled tracks visible, gentle motion blur on surrounding trees suggesting movement and speed, subtle camera sway creating dynamic sense of riding experience, snow particles and flakes caught in motion, winter wonderland forest atmosphere with dappled natural light filtering through tree branches, distant holiday cabin or warm lights visible through trees adding festive touch. Use natural ambient lighting style with soft overcast winter daylight, cool blue-white tones in shadowed areas, bright white highlights on snow surfaces, atmospheric perspective creating depth. Update outfits only to fit a festive snowy Christmas look (insulated winter coats in vibrant colors, warm snow pants, thick gloves, cozy winter hats or helmets, scarves) while keeping overall realism. Maintain the original camera angle and composition while incorporating the POV sledding perspective. Capture the thrilling, adventurous energy of winter sledding with cinematic action photography quality, sense of speed and joy. The scene should feel dynamic, immersive, and full of holiday winter excitement with professional sports photography aesthetics. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 9,
//         tags: ["landscape", "single portrait", "snow", "snowy", "image"],
//         scene: "outdoor",
//         textDefault: "Winter Adventure",
//       },
//       {
//         title: "Mistletoe Kiss",
//         category: "Romantic",
//         subCategory: "Couple / Duo",
//         type: "photo",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/2cf3b1b3-e33b-421a-9456-f1a66b65506f",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Mistletoe Kiss' Romantic Christmas template. Replace the background with: Intimate romantic scene of couple sharing tender moment under hanging mistletoe with red berries and green leaves, elegant home interior with decorated Christmas tree softly glowing in background, warm string lights creating bokeh effect, festive garlands with pine branches and red ribbons adorning doorway or archway, cozy living room atmosphere with candles and holiday decorations, soft golden backlight creating dreamy halo effect around couple with subtle lens flare adding magical romance. Use natural ambient lighting style with warm golden-hour quality light, soft backlight illuminating subjects from behind creating gentle rim light on hair and shoulders, lens flare adding ethereal romantic glow, warm color temperature throughout creating intimate atmosphere. Update outfits only to fit a festive romantic Christmas look (elegant knit sweaters, sophisticated holiday dresses, dress shirts, layered winter fashion in deep reds, greens, creams) while keeping overall realism. Maintain the original camera angle and composition. Capture deeply romantic, intimate Christmas moment with cinematic shallow depth of field, professional engagement photography quality. The scene should feel warm, magical, and timeless with soft dreamy aesthetic and authentic emotional connection. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged.",
//         creditCost: 24,
//         tags: ["couple", "couple / duo", "portrait", "romantic"],
//         scene: "tree",
//         textDefault: "Love & Joy",
//       },
//       {
//         title: "Sleigh Ride Duo",
//         category: "Romantic",
//         subCategory: "Couple / Duo",
//         type: "photo",
//         orientation: "landscape",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/7b79f88a-6e70-4668-8113-00c9b826ed77",
//         prompt:
//           "CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the 'Sleigh Ride Duo' Romantic Christmas template. Replace the background with: Romantic winter scene of couple sitting together in classic wooden sleigh being pulled by horse team, horses positioned directly in front of sleigh connected by leather harnesses and reins, the sleigh moving forward along snowy forest path, snow-covered evergreen pine trees lining both sides of the trail, fresh snow on ground with sleigh runners creating tracks, gentle snowfall adding magical atmosphere, motion blur on surrounding trees indicating forward movement, wooden sleigh features ornate carvings and red velvet seating, warm plaid blanket covering couple, evergreen garlands with red bows decorating sleigh sides, distant winter landscape with mountains visible through trees, golden sunset light filtering through forest. Use natural ambient lighting style with soft winter daylight, warm golden tones from setting sun, cool blue shadows in snow, gentle romantic glow. The composition must show proper sleigh configuration: horses in front pulling the sleigh from behind them in natural driving position, not separated or beside each other. Update outfits only to fit a festive romantic Christmas look (elegant wool coats, cashmere scarves, vintage winter fashion, rich holiday colors) while keeping overall realism. Maintain the original camera angle and composition. Capture classic romantic sleigh ride with horses properly harnessed and pulling sleigh, professional cinematic quality showing correct historical sleigh ride setup. The scene should feel authentic, elegant, and like a traditional Christmas card with proper horse-drawn sleigh mechanics clearly visible. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged. Ensure horses are positioned in front of and pulling the sleigh in proper driving formation.",
//         creditCost: 24,
//         tags: ["couple", "couple / duo", "landscape", "romantic", "snow"],
//         scene: "outdoor",
//         textDefault: "Romantic Christmas",
//       },
//       {
//         title: "Minimal Love Card",
//         category: "Romantic",
//         subCategory: "Card / No people",
//         type: "card",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/de4b859c-2228-4ead-95ea-b82a29a07b15",
//         prompt:
//           "CRITICAL: If people are present in the uploaded image, preserve their exact facial features, age, hair color, hair style, skin tone, body type, and all physical characteristics without ANY changes. However, integrate them subtly into the card design as secondary elements to the card layout itself. \nEdit the uploaded image into an elegant Christmas greeting card that matches the 'Minimal Love Card' Romantic template. Create a polished minimalist card design with: Clean white or cream background, delicate thin-line heart outline as central decorative element, elegant holly leaves with red berries artistically incorporated into or around the heart design, sophisticated text column space positioned on right side of card with ample room for personalized greeting message, subtle romantic Christmas elements like small snowflakes or stars scattered minimally, refined border or frame in gold, silver, or soft red tones. Use natural ambient lighting style with soft even illumination, clean professional photography aesthetic. The design should prioritize the card layout and decorative elements. If people are in the original image, de-emphasize them or integrate them very subtly as soft background elements or small accent photos, ensuring the card design remains the primary focus. Leave generous clear space for text placement on right column. Keep the overall portrait orientation. The aesthetic should be modern, sophisticated, and minimalist with elegant typography-friendly layout, professional greeting card quality with romantic yet understated Christmas charm. If additional user preferences are provided, apply them to color palette refinements (blush pink, deep red, forest green, metallics), decorative detail adjustments, or text mood enhancement, but do not add complex scenes or additional characters. \nREMINDER: Card layout and text space are the priority. People, if present, should be minimized or artistically integrated without dominating the design.",
//         creditCost: 6,
//         tags: ["card", "card / no people", "portrait", "romantic"],
//         scene: "tree",
//         textDefault: "With Love",
//       },
//       {
//         title: "Winter Proposal",
//         category: "Romantic",
//         subCategory: "Couple / Duo",
//         type: "photo",
//         orientation: "portrait",
//         previewUrl:
//           "https://giddy-swan-737.convex.cloud/api/storage/601ae84f-73de-40be-80a7-1e545f052177",
//         prompt:
//           'CRITICAL: Preserve the exact facial features, age, hair color, hair style, skin tone, body type, pose, and all physical characteristics of every uploaded person without ANY changes. Face and identity preservation is the absolute priority. Keep the same number of people and their relative positions in the frame unchanged. \nEdit the uploaded photo to match the "Winter Proposal" Romantic Christmas template. Replace the background with: Deeply emotional proposal moment captured in enchanting snow-covered park setting during twilight, pristine white snow blanketing ground and tree branches, elegant fairy lights strung through bare winter trees creating magical twinkling canopy overhead, warm golden glow from string lights contrasting beautifully with cool blue winter atmosphere, gentle snowfall adding romantic ambiance, snow-covered park benches and lamp posts visible, distant city lights or decorated buildings softly glowing in background, footprints in fresh snow leading to proposal spot, perhaps scattered rose petals on snow or small lanterns creating intimate circle. Use natural ambient lighting style with magical blue hour lighting, warm fairy light glow illuminating couple from above creating dreamy bokeh effect, soft reflected light from snow, ethereal twilight sky with deep blue and purple tones, gentle rim lighting on subjects. Update outfits only to fit a festive romantic Christmas look (elegant winter coats, sophisticated scarves, dressy winter attire, perhaps woman in flowing dress with coat, refined winter fashion in jewel tones or classic black and burgundy) while keeping overall realism. Maintain the original camera angle and composition. Capture raw authentic emotion of proposal moment with candid genuine expressions of surprise, joy, love, tears of happiness, professional engagement photography quality with perfect timing. The scene should feel deeply romantic, magical, and once-in-a-lifetime with cinematic movie proposal aesthetics, emotional storytelling, and breathtaking winter wonderland beauty. If additional user preferences are provided, treat them as secondary styling notes (colors, small props, mood) and only apply them when they do not conflict with the template layout or subject preservation. \nREMINDER: Keep all uploaded faces, bodies, ages, and identities completely unchanged. Preserve authentic emotional expressions.',
//         creditCost: 18,
//         tags: ["couple / duo", "portrait", "romantic", "snow"],
//         scene: "outdoor",
//         textDefault: "Forever Yours",
//       },
//     ];

//     // Insert items (do not clear existing templates to avoid accidental deletion)
//     for (const item of items) {
//       await ctx.db.insert("templates", item);
//     }

//     return { success: true, count: items.length };
//   },
// });

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("templates"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      category: v.string(),
      subCategory: v.string(),
      type: v.string(),
      orientation: v.union(v.literal("portrait"), v.literal("landscape")),
      aspectRatio: v.string(),
      previewUrl: v.string(),
      thumbnailUrl: v.string(),
      creditCost: v.number(),
      tags: v.array(v.string()),
      scene: v.string(),
      textDefault: v.string(),
    })
  ),
  handler: async (ctx) => {
    const templates = await ctx.db.query("templates").collect();
    return templates.map(sanitizeTemplate);
  },
});

export const getByScene = query({
  args: { scene: v.string() },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_scene", (q) => q.eq("scene", args.scene))
      .collect();
    return templates.map(sanitizeTemplate);
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) return null;
    return sanitizeTemplate(template);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
    const filtered = allTemplates.filter((template) =>
      args.tags.some((tag) => template.tags.includes(tag))
    );
    return filtered.map(sanitizeTemplate);
  },
});

// Get templates by price range
export const getByPriceRange = query({
  args: {
    minCost: v.optional(v.number()),
    maxCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("templates");

    if (args.minCost !== undefined) {
      query = query.filter((q) => q.gte(q.field("creditCost"), args.minCost!));
    }

    if (args.maxCost !== undefined) {
      query = query.filter((q) => q.lte(q.field("creditCost"), args.maxCost!));
    }

    const templates = await query.collect();
    return templates.map(sanitizeTemplate);
  },
});

// Atomic internal mutation to debit credits and create a job (prevents race conditions)
// atomic debit+job creation moved to `convex/atomic.ts` to avoid circular type references

// Create job from template - implemented above as `createFromTemplate`.

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
