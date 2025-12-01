"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import nodemailer from "nodemailer";

// Create NodeMailer transporter with SSL/STARTTLS support
function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT || "587");

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    requireTLS: port === 587, // Require TLS for port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      // Allow self-signed certificates for cPanel
      rejectUnauthorized: false,
    },
  });
}

// Send new template notification to all subscribed users via email
export const sendNewTemplateNotification = internalAction({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    console.log(
      `[Email] Starting email campaign for template: ${args.templateId}`
    );

    // Fetch template details (without sensitive prompt)
    const template = (await ctx.runQuery(internal.emails.getTemplateForEmail, {
      templateId: args.templateId,
    })) as any;

    if (!template) {
      console.error("[Email] Template not found:", args.templateId);
      return { success: false, error: "Template not found" };
    }

    // Fetch all subscribed users
    const subscribers = (await ctx.runQuery(
      internal.emails.getEmailSubscribers
    )) as { email: string; userId: string }[];

    console.log(`[Email] Found ${subscribers.length} subscribed users`);

    if (subscribers.length === 0) {
      console.log("[Email] No subscribers found, skipping email campaign");
      return { success: true, recipientCount: 0 };
    }

    // Create transporter
    const transporter = createTransporter();

    // Send emails in batches to avoid rate limits
    const batchSize = 10; // Small batches for Gmail (new account)
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);

      console.log(
        `[Email] Sending batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(subscribers.length / batchSize)}`
      );

      const results = await Promise.allSettled(
        batch.map((subscriber: { email: string; userId: string }) =>
          sendTemplateEmail(transporter, subscriber, template)
        )
      );

      // Count successes and failures
      results.forEach((result: PromiseSettledResult<any>, index: number) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          errorCount++;
          console.error(
            `[Email] Failed to send to ${batch[index].email}:`,
            result.reason
          );
        }
      });

      // Wait 3 seconds between batches to avoid rate limits
      if (i + batchSize < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // Log email campaign
    await ctx.runMutation(internal.emails.logEmailCampaign as any, {
      templateId: args.templateId,
      recipientCount: subscribers.length,
      successCount,
      errorCount,
    });

    console.log(
      `[Email] Campaign complete: ${successCount} sent, ${errorCount} failed`
    );
    console.log(`
═══════════════════════════════════════
📧 Email Campaign Summary
═══════════════════════════════════════
Template ID: ${args.templateId}
Total Recipients: ${subscribers.length}
Successfully Sent: ${successCount}
Failed: ${errorCount}
Success Rate: ${subscribers.length > 0 ? ((successCount / subscribers.length) * 100).toFixed(1) : "0"}%
═══════════════════════════════════════
    `);

    return {
      success: true,
      recipientCount: subscribers.length,
      successCount,
      errorCount,
    };
  },
});

// Helper to send individual email using NodeMailer
async function sendTemplateEmail(
  transporter: any,
  subscriber: { email: string; userId: string },
  template: any
) {
  const unsubscribeUrl = `${process.env.PUBLIC_APP_URL}/unsubscribe?userId=${subscriber.userId}`;
  const textContent = generateEmailText(template, unsubscribeUrl);

  const mailOptions = {
    from: `"TheDigitalGifter" <${process.env.SMTP_USER}>`, // Gmail address from env
    replyTo: process.env.SMTP_USER,
    to: subscriber.email,
    subject: `🎨 New ${template.type.charAt(0).toUpperCase() + template.type.slice(1)} Template: ${template.title}`,
    text: textContent, // Plain text version is CRITICAL for spam filters
    html: generateEmailHTML(template, unsubscribeUrl),
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      Precedence: "bulk",
      "X-Auto-Response-Suppress": "OOF, DR, RN, NRN, AutoReply",
    },
  };

  return await transporter.sendMail(mailOptions);
}

// Generate plain text version for better deliverability
function generateEmailText(template: any, unsubscribeUrl: string) {
  return `
🎨 New Template Available!

We've just added a stunning new ${template.type} template to our collection: ${template.title}

---------------------------------------------------
TEMPLATE DETAILS
---------------------------------------------------
Title: ${template.title}
Category: ${template.category}
Type: ${template.type.toUpperCase()}
Cost: ${template.creditCost} credits

Scene: ${template.scene}
Orientation: ${template.orientation}
${template.subCategory ? `Style: ${template.subCategory}` : ""}

---------------------------------------------------
Try This Template Now:
${process.env.PUBLIC_APP_URL}/templates
---------------------------------------------------

You're receiving this because you signed up for TheDigitalGifter.

Visit Website: ${process.env.PUBLIC_APP_URL}

Unsubscribe: ${unsubscribeUrl}
  `.trim();
}

// Generate email HTML
function generateEmailHTML(template: any, unsubscribeUrl: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 700;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.95;
          }
          .content { 
            padding: 30px;
          }
          .template-card { 
            background: #f9fafb; 
            border-radius: 12px; 
            padding: 20px; 
            margin: 20px 0;
          }
          .template-image { 
            width: 100%; 
            border-radius: 8px; 
            margin-bottom: 20px;
            display: block;
          }
          .template-title {
            font-size: 24px;
            font-weight: 700;
            color: #1a202c;
            margin: 0 0 15px 0;
          }
          .badge-container {
            margin: 15px 0;
          }
          .badge { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 6px 14px; 
            border-radius: 20px; 
            font-size: 13px; 
            margin: 5px 5px 5px 0;
            font-weight: 500;
          }
          .detail-row {
            margin: 10px 0;
            font-size: 15px;
            color: #4a5568;
          }
          .detail-row strong {
            color: #2d3748;
            font-weight: 600;
          }
          .cta-button { 
            display: inline-block; 
            background: #667eea; 
            color: white !important; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 25px 0 15px 0;
            font-weight: 600;
            font-size: 16px;
            transition: background 0.3s;
          }
          .cta-button:hover {
            background: #5568d3;
          }
          .footer { 
            text-align: center; 
            padding: 30px 20px; 
            color: #718096; 
            font-size: 13px;
            background: #f7fafc;
            border-top: 1px solid #e2e8f0;
          }
          .footer a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
          }
          .footer a:hover {
            text-decoration: underline;
          }
          .unsubscribe {
            margin-top: 15px;
            font-size: 12px;
            color: #a0aec0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎨 New Template Available!</h1>
            <p>We've just added a stunning new ${template.type} template to our collection</p>
          </div>
          
          <div class="content">
            <div class="template-card">
              ${template.previewUrl ? `<img src="${template.previewUrl}" alt="${template.title}" class="template-image">` : ""}
              
              <h2 class="template-title">${template.title}</h2>
              
              <div class="badge-container">
                <span class="badge">📁 ${template.category}</span>
                <span class="badge">🎬 ${template.type.toUpperCase()}</span>
                <span class="badge">💎 ${template.creditCost} credits</span>
              </div>
              
              <div class="detail-row"><strong>Scene:</strong> ${template.scene}</div>
              <div class="detail-row"><strong>Orientation:</strong> ${template.orientation}</div>
              ${template.subCategory ? `<div class="detail-row"><strong>Style:</strong> ${template.subCategory}</div>` : ""}
              
              <div style="text-align: center;">
                <a href="${process.env.PUBLIC_APP_URL}/templates" class="cta-button">
                  Try This Template Now →
                </a>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>You're receiving this because you signed up for TheDigitalGifter</p>
            <p>
              <a href="${process.env.PUBLIC_APP_URL}">Visit Website</a>
            </p>
            <p class="unsubscribe">
              Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}
