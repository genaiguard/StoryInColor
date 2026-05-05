import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { defineSecret } from 'firebase-functions/params';

// AWS credentials are real secrets and stay in Secret Manager. AWS_REGION
// is just a region string (us-east-1) — moved to functions/.env to avoid
// burning a secret-fetch slot + cold-start time on a non-secret value.
const awsAccessKeyId = defineSecret('AWS_ACCESS_KEY_ID');
const awsSecretAccessKey = defineSecret('AWS_SECRET_ACCESS_KEY');
const senderEmail = defineSecret('SENDER_EMAIL_ADDRESS');

// Read AWS_REGION from process.env (populated from functions/.env at deploy time).
// Default to us-east-1 if missing to avoid hard-failing welcome emails.
const awsRegion = (): string => process.env.AWS_REGION || 'us-east-1';

// Interface for AWS SES errors. v3 throws actual Error objects with `name`,
// but legacy `code`-shaped errors still appear in some downstream paths.
interface AWSError {
  code?: string;
  name?: string;
  message?: string;
  [key: string]: any;
}

// Configure AWS SES (v3 client). The v3 client is tree-shakeable + smaller
// cold-start than the v2 monolithic `aws-sdk` package, and v2 is in
// maintenance-only mode (CVEs no longer get backported reliably).
export const configureSES = () => {
  console.log(`[AWS SES] Configuring SES with region: ${awsRegion()}`);

  const ses = new SESClient({
    credentials: {
      accessKeyId: awsAccessKeyId.value(),
      secretAccessKey: awsSecretAccessKey.value(),
    },
    region: awsRegion(),
  });

  console.log('[AWS SES] SES client configured successfully');
  return ses;
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, name?: string) => {
  console.log(`[AWS SES] Preparing to send welcome email to ${email}, name: ${name || 'not provided'}`);
  
  try {
    const ses = configureSES();
    
    // Generate the email template
    const emailTemplate = generateWelcomeEmailTemplate(name || 'there');
    console.log(`[AWS SES] Welcome email template ready (${emailTemplate.length} chars)`);


    // Log AWS configuration being used. NOTE: never log a prefix of the
    // access key — even 8 chars correlate against rotated/leaked credentials.
    console.log(`[AWS SES] Using AWS Region: ${awsRegion()}`);
    console.log(`[AWS SES] Using Sender Email: ${senderEmail.value()}`);


    // Construct email params
    const params = {
      Source: senderEmail.value(),
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Welcome to StoryInColor!' },
        Body: {
          Html: {
            Data: emailTemplate
          }
        }
      }
    };
    
    console.log('[AWS SES] Email parameters prepared:', JSON.stringify({
      source: params.Source,
      destination: params.Destination,
      subject: params.Message.Subject.Data
    }));
    
    try {
      console.log('[AWS SES] Sending email via SES SendEmailCommand');
      const result = await ses.send(new SendEmailCommand(params));
      console.log(`[AWS SES] Email successfully sent, MessageId: ${result.MessageId}`);
      return true;
    } catch (error) {
      const sesError = error as AWSError;
      console.error('[AWS SES] SES sending error:', sesError);
      // v3 uses `name` for the error type; legacy `code` may still surface.
      if (sesError.name || sesError.code) {
        console.error(`[AWS SES] Error type: ${sesError.name ?? sesError.code}, message: ${sesError.message}`);
      }
      throw sesError;
    }
  } catch (err) {
    const error = err as Error;
    console.error('[AWS SES] General error sending welcome email:', error);
    return false;
  }
};

// Send contact form email
export const sendContactFormEmail = async (
  name: string,
  email: string,
  subject: string,
  message: string
) => {
  console.log(`[AWS SES] Preparing to send contact form email from ${name} (${email})`);
  
  const ses = configureSES();

  // Contact-form submissions get sent to the sender address (info@…) AND
  // to a personal admin notification address. The personal address is
  // not a security check — just a recipient — so it lives in
  // functions/.env (ADMIN_NOTIFICATION_EMAIL) rather than as a Firebase
  // secret. Falls back to senderEmail-only if the env var is unset.
  const notificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const toAddresses = notificationEmail
    ? [senderEmail.value(), notificationEmail]
    : [senderEmail.value()];

  const params = {
    Source: senderEmail.value(),
    Destination: {
      ToAddresses: toAddresses,
    },
    ReplyToAddresses: [email], // Allow replying directly to the sender
    Message: {
      Subject: { Data: `Contact Form: ${subject}` },
      Body: {
        Html: {
          Data: generateContactFormTemplate(name, email, subject, message)
        }
      }
    }
  };
  
  try {
    const result = await ses.send(new SendEmailCommand(params));
    console.log(`[AWS SES] Contact form email sent, MessageId: ${result.MessageId}`);
    return true;
  } catch (err) {
    const error = err as AWSError;
    console.error('[AWS SES] Error sending contact form email:', error);
    if (error.name || error.code) {
      console.error(`[AWS SES] Error type: ${error.name ?? error.code}, message: ${error.message}`);
    }
    return false;
  }
};

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
//
// Design choice: the WEBSITE is cinematic dark, but emails render against a
// LIGHT cream/white background. Three reasons:
//   1) Most email clients still default to light-mode rendering, and a dark
//      template inverted by Apple Mail/Gmail's auto-darkening looks worse than
//      a light template that those clients leave alone.
//   2) The actual readings the product delivers ARE printed black-on-cream
//      editorial spreads — so the email mirrors the product's deliverable.
//   3) Light + tight typography + restrained color reads as a magazine, which
//      is the brand promise.
//
// Constraints:
//   - Inline CSS only (Gmail strips <style>).
//   - Table-based layout for legacy clients.
//   - System font stack — Google Fonts in email is unreliable.
//   - No external images (better deliverability + spam scoring).
// ---------------------------------------------------------------------------

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
// Dark editorial palette — mirrors the site (storyincolor.com is black
// background with white text and gray accents). Hex values match the
// Tailwind gray scale used on the site's components: gray-300 for body
// copy, gray-400 for muted, gray-500 for very muted, plus pure black
// outer / near-black card with a subtle hairline border.
const PAGE_BG = "#000000"; // outer black
const CARD_BG = "#0a0a0a"; // near-black card with depth
const RULE = "#1f1f1f"; // hairline border (subtle but visible on dark)
const INK = "#ffffff"; // primary text / headlines
const INK_2 = "#d1d5db"; // body text — Tailwind gray-300
const MUTED = "#9ca3af"; // muted — Tailwind gray-400 (used for italic accents)
const MUTED_2 = "#6b7280"; // extra muted — Tailwind gray-500
// Button colours: bg-white + text-black matches the site's primary CTA
// pattern (Read my photo / Buy a reading / Buy now).
const BTN_BG = "#ffffff";
const BTN_TEXT = "#111111";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateWelcomeEmailTemplate(name: string): string {
  const safeName = escapeHtml(name);
  const greeting = name && name !== "there" ? `Hi ${safeName} —` : "Welcome —";
  // Brand wordmark with three font-weights, mirroring the site mark
  // ("Story" light + "In" semibold + "Color" light).
  const wordmark = `<span style="font-weight:300;">Story</span><span style="font-weight:600;">In</span><span style="font-weight:300;">Color</span>`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Welcome to StoryInColor</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PAGE_BG}; font-family:${FONT_STACK}; color:${INK_2};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:${CARD_BG}; border:1px solid ${RULE};">
            <!-- Brand bar — three-weight wordmark mirrors the site mark -->
            <tr>
              <td style="padding:22px 32px; border-bottom:1px solid ${RULE}; text-align:center;">
                <span style="font-size:14px; letter-spacing:-0.02em; color:${INK};">${wordmark}</span>
              </td>
            </tr>
            <!-- Headline. The italic gray accent on the second line
                 mirrors the site's editorial heading pattern (e.g.
                 "Pick your <em>pack.</em>" on /credits). -->
            <tr>
              <td style="padding:56px 40px 8px;">
                <p style="margin:0; font-size:11px; font-weight:500; letter-spacing:0.18em; color:${MUTED_2}; text-transform:uppercase;">Welcome</p>
                <h1 style="margin:18px 0 0; font-size:36px; line-height:1.05; font-weight:400; letter-spacing:-0.04em; color:${INK};">
                  ${greeting}<br />
                  <span style="font-style:italic; font-weight:300; color:${MUTED};">we've saved you a seat.</span>
                </h1>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:24px 40px 0;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:${INK_2};">
                  StoryInColor turns one photo into an editorial reading — palm, face, beauty, aura, iridology, handwriting, style, skincare. Each one is a magazine-quality spread, designed to be saved.
                </p>
                <p style="margin:0; font-size:16px; line-height:1.6; color:${INK_2};">
                  Upload a photo and your reading lands in up to 2 minutes.
                </p>
              </td>
            </tr>
            <!-- CTA — white pill on the dark card matches the site's
                 primary button (Read my photo / Buy a reading / Buy now). -->
            <tr>
              <td align="center" style="padding:36px 40px 12px;">
                <a href="https://storyincolor.com/readings" style="display:inline-block; padding:14px 28px; background-color:${BTN_BG}; color:${BTN_TEXT}; text-decoration:none; font-size:14px; font-weight:500; letter-spacing:-0.005em; border-radius:999px;">
                  See the reading room
                </a>
              </td>
            </tr>
            <!-- Pricing footnote + 30-day guarantee. Conversion best
                 practice on transactional welcome emails: surface the
                 risk-reduction message immediately after the pricing
                 line so price anxiety is countered in the same eye-line
                 sweep. Industry studies (Conversion Fanatics, CRE,
                 Drip) show +21–49% conversion lift across replicated
                 tests when a satisfaction guarantee is visible at the
                 commitment moment. -->
            <tr>
              <td align="center" style="padding:8px 40px 12px;">
                <p style="margin:0; font-size:12px; line-height:1.5; color:${MUTED};">
                  Pay-as-you-go from <span style="color:${INK_2};">$6.50 per reading</span>.<br />
                  Single $9.99 · 3-pack $8 each · 6-pack $6.50 each.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 40px 56px;">
                <p style="margin:0; font-size:12px; color:${INK};">
                  <strong style="font-weight:500;">30-day satisfaction guarantee.</strong>
                </p>
              </td>
            </tr>
            <!-- Footer. Do-not-reply disclaimer per best-practice format
                 for transactional welcome emails: italic + extra-muted
                 colour to differentiate from the legal copyright
                 line below. The earlier "Questions? Just reply" prompt
                 was removed because the sending mailbox is unmonitored
                 — actual support routes through info@storyincolor.com
                 (linked above in the guarantee line). -->
            <tr>
              <td style="padding:22px 32px; border-top:1px solid ${RULE}; text-align:center;">
                <p style="margin:0 0 4px; font-size:12px; font-style:italic; color:${MUTED_2};">
                  This mailbox is not monitored.
                </p>
                <p style="margin:0; font-size:11px; color:${MUTED_2};">
                  © ${new Date().getFullYear()} Story In Color · <a href="https://storyincolor.com" style="color:${MUTED_2}; text-decoration:underline;">storyincolor.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function generateContactFormTemplate(
  name: string,
  email: string,
  subject: string,
  message: string,
): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Contact form: ${safeSubject}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PAGE_BG}; font-family:${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:${CARD_BG}; border:1px solid ${RULE};">
            <tr>
              <td style="padding:22px 32px; border-bottom:1px solid ${RULE};">
                <span style="font-size:11px; font-weight:500; letter-spacing:0.18em; color:${MUTED}; text-transform:uppercase;">Story In Color · Contact form</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <h1 style="margin:0; font-size:22px; line-height:1.2; font-weight:500; letter-spacing:-0.02em; color:${INK};">
                  ${safeSubject}
                </h1>
                <p style="margin:10px 0 0; font-size:13px; color:${MUTED};">
                  From <strong style="color:${INK_2}; font-weight:500;">${safeName}</strong> &lt;<a href="mailto:${safeEmail}" style="color:${INK_2}; text-decoration:underline;">${safeEmail}</a>&gt;
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <div style="background-color:${PAGE_BG}; border:1px solid ${RULE}; padding:18px 20px; font-size:15px; line-height:1.6; color:${INK_2};">
                  ${safeMessage}
                </div>
                <p style="margin:18px 0 0; font-size:12px; color:${MUTED};">
                  Reply directly to this email to reach the sender.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}


/* -------------------------------------------------------------------------- */
/* Daily Reflection email                                                     */
/* Per QUIZ-PIVOT-SPEC.md §17.5. Sent to subscribers only — gated upstream    */
/* by daily-reflections.ts loadActiveSubscribers().                           */
/* -------------------------------------------------------------------------- */

function generateDailyReflectionTemplate(
  reflectionText: string,
  name?: string,
): string {
  const safeName = escapeHtml(name || "");
  const safeText = escapeHtml(reflectionText)
    // preserve paragraph breaks if any
    .replace(/\n\n+/g, "</p><p style=\"margin:0 0 14px 0;\">")
    .replace(/\n/g, "<br/>");
  const greeting = safeName ? `Hi ${safeName} —` : "Hi —";
  const wordmark = `<span style="font-weight:300;">Story</span><span style="font-weight:600;">In</span><span style="font-weight:300;">Color</span>`;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>Today's Reflection</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PAGE_BG}; font-family:${FONT_STACK}; color:${INK_2};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:${CARD_BG}; border:1px solid ${RULE};">
            <tr>
              <td style="padding:22px 32px; border-bottom:1px solid ${RULE}; text-align:center;">
                <span style="font-size:14px; letter-spacing:-0.02em; color:${INK};">${wordmark}</span>
                <div style="margin-top:6px; font-size:11px; color:${MUTED_2}; letter-spacing:0.08em; text-transform:uppercase;">
                  Today's Reflection · ${today}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 18px 32px;">
                <p style="margin:0 0 18px 0; font-size:14px; color:${MUTED};">${greeting}</p>
                <p style="margin:0 0 14px 0; font-size:17px; line-height:1.65; color:${INK_2}; font-style:italic;">${safeText}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px 32px;">
                <a href="https://storyincolor.com/dashboard" style="display:inline-block; padding:11px 20px; background-color:${BTN_BG}; color:${BTN_TEXT}; text-decoration:none; font-size:13px; font-weight:500; letter-spacing:-0.01em;">
                  Open my library
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 24px 32px; border-top:1px solid ${RULE};">
                <p style="margin:0; font-size:11px; line-height:1.6; color:${MUTED_2};">
                  Drawn from your Reading Profile. You can change cadence or
                  pause Reflections in
                  <a href="https://storyincolor.com/dashboard/profile" style="color:${MUTED_2}; text-decoration:underline;">your profile settings</a>.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0; font-size:11px; color:${MUTED_2}; line-height:1.6; max-width:560px;">
            This mailbox is not monitored.
            <br/>© ${new Date().getFullYear()} Story In Color
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const sendDailyReflectionEmail = async (
  email: string,
  reflectionText: string,
  name?: string,
): Promise<boolean> => {
  try {
    const ses = configureSES();
    const html = generateDailyReflectionTemplate(reflectionText, name);
    const params = {
      Source: senderEmail.value(),
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: "Today's Reflection · StoryInColor",
        },
        Body: { Html: { Data: html } },
      },
    };
    const result = await ses.send(new SendEmailCommand(params));
    console.log(
      `[AWS SES] Daily reflection sent to ${email}, MessageId: ${result.MessageId}`,
    );
    return true;
  } catch (err) {
    console.error("[AWS SES] Daily reflection send error:", err);
    return false;
  }
};
