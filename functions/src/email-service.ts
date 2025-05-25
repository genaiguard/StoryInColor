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

// Email template generators
// Force redeploy - Updated 2025-05-25
function generateWelcomeEmailTemplate(name: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f97316;">Welcome to StoryInColor, ${name}!</h1>
        </div>
        
        <p>Thank you for joining StoryInColor! We're excited to help you turn your favorite photos into beautiful custom coloring pages.</p>
        
        <p>With StoryInColor, you can:</p>
        <ul>
          <li>Upload your vacation, family, or pet photos</li>
          <li>Instantly create unique coloring pages from your images</li>
          <li>Download and print your creations at home</li>
          <li>Share your coloring pages with friends and family</li>
        </ul>
        
        <div style="background-color: #f8f4e6; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p style="margin: 0;"><strong>Ready to get started?</strong></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://storyincolor.com/dashboard" 
             style="display: inline-block; background-color: #f97316; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 18px; font-weight: bold;">
            Go to Your Dashboard
          </a>
        </div>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        
        <p>Happy coloring!<br/>The StoryInColor Team</p>
      </body>
    </html>
  `;
}

// Generate contact form email template
function generateContactFormTemplate(name: string, email: string, subject: string, message: string): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f97316;">New Contact Form Submission</h1>
        </div>
        
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        
        <div style="background-color: #f8f4e6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #f97316;">Message:</h2>
          <p>${message.replace(/\n/g, '<br/>')}</p>
        </div>
        
        <p>You can reply directly to this email to respond to the sender.</p>
      </body>
    </html>
  `;
}

// Helper function formatProductName block REMOVED 