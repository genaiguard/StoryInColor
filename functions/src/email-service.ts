import * as AWS from 'aws-sdk';
import { defineSecret } from 'firebase-functions/params';

// Define AWS secrets
const awsAccessKeyId = defineSecret('AWS_ACCESS_KEY_ID');
const awsSecretAccessKey = defineSecret('AWS_SECRET_ACCESS_KEY');
const awsRegion = defineSecret('AWS_REGION');
const senderEmail = defineSecret('SENDER_EMAIL_ADDRESS');

// Interface for AWS SES errors
interface AWSError {
  code?: string;
  message?: string;
  [key: string]: any;
}

// Configure AWS SES
export const configureSES = () => {
  console.log(`[AWS SES] Configuring SES with region: ${awsRegion.value()}`);
  
  const ses = new AWS.SES({
    accessKeyId: awsAccessKeyId.value(),
    secretAccessKey: awsSecretAccessKey.value(),
    region: awsRegion.value() || 'us-east-1',
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
    
    // Log comprehensive debugging information
    console.log(`[AWS SES] Email template preview (first 300 chars): ${emailTemplate.substring(0, 300)}...`);
    console.log(`[AWS SES] Template contains button: ${emailTemplate.includes('Go to Your Dashboard')}`);
    console.log(`[AWS SES] Template contains old text 'Order printed copies': ${emailTemplate.includes('Order printed copies')}`);
    console.log(`[AWS SES] Template contains old text 'our platform': ${emailTemplate.includes('our platform')}`);
    console.log(`[AWS SES] Template contains old text 'book formats': ${emailTemplate.includes('book formats')}`);
    console.log(`[AWS SES] Template contains new text 'StoryInColor!': ${emailTemplate.includes('StoryInColor!')}`);
    console.log(`[AWS SES] Full template length: ${emailTemplate.length} characters`);
    
    // Log AWS configuration being used
    console.log(`[AWS SES] Using AWS Region: ${awsRegion.value()}`);
    console.log(`[AWS SES] Using Sender Email: ${senderEmail.value()}`);
    console.log(`[AWS SES] AWS Access Key ID prefix: ${awsAccessKeyId.value().substring(0, 8)}...`);
    
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
      console.log('[AWS SES] Sending email via SES.sendEmail()');
      const result = await ses.sendEmail(params).promise();
      console.log(`[AWS SES] Email successfully sent, MessageId: ${result.MessageId}`);
      return true;
    } catch (error) {
      const sesError = error as AWSError;
      console.error('[AWS SES] SES sending error:', sesError);
      if (sesError.code) {
        console.error(`[AWS SES] Error code: ${sesError.code}, message: ${sesError.message}`);
      }
      throw sesError;
    }
  } catch (err) {
    const error = err as Error;
    console.error('[AWS SES] General error sending welcome email:', error);
    return false;
  }
};

// Send project submission email function REMOVED

// Send contact form email
export const sendContactFormEmail = async (
  name: string,
  email: string,
  subject: string,
  message: string
) => {
  console.log(`[AWS SES] Preparing to send contact form email from ${name} (${email})`);
  
  const ses = configureSES();
  
  const params = {
    Source: senderEmail.value(),
    Destination: { 
      ToAddresses: [senderEmail.value(), 'ipekcioglu@me.com'], // Send to both admin and your personal email
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
    const result = await ses.sendEmail(params).promise();
    console.log(`[AWS SES] Contact form email sent, MessageId: ${result.MessageId}`);
    return true;
  } catch (err) {
    const error = err as AWSError;
    console.error('[AWS SES] Error sending contact form email:', error);
    if (error.code) {
      console.error(`[AWS SES] Error code: ${error.code}, message: ${error.message}`);
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
const PAGE_BG = "#f5f3ee"; // outer cream
const CARD_BG = "#ffffff";
const RULE = "#eae6dc";
const INK = "#111111";
const INK_2 = "#444444";
const MUTED = "#888888";
const MUTED_2 = "#aaaaaa";

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
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Welcome to StoryInColor</title>
  </head>
  <body style="margin:0; padding:0; background-color:${PAGE_BG}; font-family:${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:${CARD_BG}; border:1px solid ${RULE};">
            <!-- Brand bar -->
            <tr>
              <td style="padding:22px 32px; border-bottom:1px solid ${RULE}; text-align:center;">
                <span style="font-size:11px; font-weight:500; letter-spacing:0.18em; color:${MUTED}; text-transform:uppercase;">Story In Color</span>
              </td>
            </tr>
            <!-- Headline -->
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
                  StoryInColor turns one photo into an editorial reading — palm, face, beauty, aura, iridology, handwriting, style, skincare, plate, plant, room. Each one is a magazine-quality spread, designed to be saved.
                </p>
                <p style="margin:0; font-size:16px; line-height:1.6; color:${INK_2};">
                  Bring whatever you have a photo of and we'll write you back in about 30 seconds.
                </p>
              </td>
            </tr>
            <!-- CTA -->
            <tr>
              <td align="center" style="padding:36px 40px 12px;">
                <a href="https://storyincolor.com/readings" style="display:inline-block; padding:14px 28px; background-color:${INK}; color:#ffffff; text-decoration:none; font-size:14px; font-weight:500; letter-spacing:-0.005em; border-radius:999px;">
                  See the reading room
                </a>
              </td>
            </tr>
            <!-- Pricing footnote -->
            <tr>
              <td style="padding:8px 40px 56px; text-align:center;">
                <p style="margin:0; font-size:12px; color:${MUTED};">
                  One reading is one purchase. Single Issue $9.99, Three pack $24, Six pack $39.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:22px 32px; border-top:1px solid ${RULE}; text-align:center;">
                <p style="margin:0 0 4px; font-size:12px; color:${MUTED};">
                  Questions? Just reply to this email.
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

// Helper function formatProductName block REMOVED