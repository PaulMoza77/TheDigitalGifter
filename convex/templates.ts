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
    type: (template as any).type || "image",
    orientation: (template as any).orientation || "portrait",
    aspectRatio: (template as any).aspectRatio || "",
    previewUrl: (template as any).previewUrl || "",
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
