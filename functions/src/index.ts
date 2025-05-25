import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';
import { sendWelcomeEmail, sendContactFormEmail } from './email-service';
import { Storage } from '@google-cloud/storage'; // Import Storage
import OpenAI from 'openai'; // Import OpenAI - Re-enabled for image processing
import sharp from 'sharp'; // Import sharp
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import fetch from 'node-fetch'; // Import fetch for Node.js
import FormData from 'form-data'; // Import FormData for Node.js
import PDFDocument from 'pdfkit'; // Import PDFKit for PDF generation
import * as fs from 'fs'; // Import fs for file operations
import * as os from 'os'; // Import os for temp directory access
import * as path from 'path'; // Import path for file path operations
import { CREDIT_PACKAGES } from './credit-packages';

// Version log - update this to verify deployments
console.log('Cloud Functions initializing - OpenAI Integration Version');

// Define secrets - Use UPPER_SNAKE_CASE for variable names too
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
const AWS_REGION = defineSecret('AWS_REGION');
const SENDER_EMAIL_ADDRESS = defineSecret('SENDER_EMAIL_ADDRESS');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore(); // Initialize Firestore globally here
const auth = admin.auth();    // Initialize Auth globally here
const storageClient = new Storage(); // Initialize Storage client
const bucketName = admin.app().options.storageBucket || process.env.GCLOUD_STORAGE_BUCKET;
if (!bucketName) {
    throw new Error("Storage bucket name not found. Ensure default bucket is configured or GCLOUD_STORAGE_BUCKET env var is set.");
}
const bucket = storageClient.bucket(bucketName);

/**
 * Handles Stripe webhook events
 */
export const stripeWebhook = onRequest(
  {
    secrets: [
      STRIPE_SECRET_KEY, 
      STRIPE_WEBHOOK_SECRET,
      // AWS secrets for email services
      AWS_ACCESS_KEY_ID, 
      AWS_SECRET_ACCESS_KEY, 
      AWS_REGION, 
      SENDER_EMAIL_ADDRESS 
    ],
    invoker: 'public'
  },
  async (req, res) => {
      console.log("[Webhook] Received request.");
      const signature = req.headers['stripe-signature'] as string;

      if (!signature) {
          console.warn('[Webhook Error] Missing stripe-signature header.');
          res.status(400).send('Bad Request - Missing stripe-signature header.');
          return;
      }

      try {
          console.log("[Webhook] Initializing Stripe client for verification.");
          // Fetch the secret and apply stronger validation
          let stripeKey = STRIPE_SECRET_KEY.value();
          
          // Check if key matches expected format pattern (sk_live_... or sk_test_...)
          const isValidStripeKeyFormat = /^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey);
          console.log(`[Webhook] Secret key format valid: ${isValidStripeKeyFormat}`);
          
          if (!isValidStripeKeyFormat) {
            console.error('[Webhook] API key has invalid format - this will cause auth errors');
            // Try to sanitize by removing all non-ASCII characters
            const originalLength = stripeKey.length;
            stripeKey = stripeKey.replace(/[^\x20-\x7E]/g, '');
            console.log(`[Webhook] Sanitized key: removed ${originalLength - stripeKey.length} non-ASCII chars`);
          }
          
          // Log a sanitized version for debugging
          console.log(`[Webhook] Secret key prefix: ${stripeKey.substring(0, 8)}... (length: ${stripeKey.length})`);
          
          const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16' // Updated to a newer version
          });

          let event: Stripe.Event;
          try {
              // Use rawBody for verification
              const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
              console.log("[Webhook] Constructing event...");
              
              // Trim the webhook secret to remove any whitespace
              const webhookSecret = STRIPE_WEBHOOK_SECRET.value().trim();
              console.log(`[Webhook] Using webhook secret (length: ${webhookSecret.length})`);
              
              event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
              console.log(`[Webhook] Event constructed successfully: ${event.id}, Type: ${event.type}`);
          } catch (err) {
              console.error('[Webhook Error] Signature verification failed:', err);
              res.status(400).send('Webhook Error - Signature verification failed.');
              return;
          }

          // Handle the checkout.session.completed event
          if (event.type === 'checkout.session.completed') {
              const session = event.data.object as Stripe.Checkout.Session;
              console.log(`[Webhook] Handling checkout.session.completed for session: ${session.id}`);
              console.log(`[Webhook] Payment status: ${session.payment_status}`);
              console.log(`[Webhook] Payment method: ${session.payment_method_types?.join(', ')}`);
              console.log(`[Webhook] Full session object: ${JSON.stringify(session)}`);

              // Check if this is a credit purchase
              if (session.metadata?.type === 'credit_purchase') {
                  // Handle credit purchase
                  console.log(`[Webhook] Processing credit purchase`);

              const userId = session.metadata?.userId;
                  const packageId = session.metadata?.packageId;
                  const creditAmount = session.metadata?.creditAmount ? parseInt(session.metadata.creditAmount, 10) : 0;
                  const priceInCents = session.metadata?.priceInCents ? parseInt(session.metadata.priceInCents, 10) : 0;
                  
                  if (!userId || !packageId || creditAmount <= 0) {
                      console.error('[Webhook Error] Missing userId, packageId, or valid creditAmount in session metadata.', session.metadata);
                      res.status(200).send({ received: true, error: 'Missing required metadata for credit purchase' });
                  return;
              }
                  
                  // Only process if payment is successful
                  if (session.payment_status === 'paid') {
                      try {
                          console.log(`[Credits] Adding ${creditAmount} credits for user ${userId}`);
                          const userCreditsRef = db.collection('userCredits').doc(userId);
                          
                          // Get current user credits or create if not exists
                          const userCreditsDoc = await userCreditsRef.get();
                          if (!userCreditsDoc.exists) {
                              // Create new user credits document
                              await userCreditsRef.set({
                                  balance: creditAmount,
                                  used: 0,
                                  purchaseHistory: [{
                                      packageId,
                                      creditAmount,
                                      pricePaid: priceInCents,
                                      purchaseDate: new Date() // Use regular Date instead of server timestamp
                                  }],
                                  usageHistory: [],
                                  lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                              });
                                      } else {
                              // Update existing user credits document
                              // We don't need the existing data for an increment operation
                              await userCreditsRef.update({
                                  balance: admin.firestore.FieldValue.increment(creditAmount),
                                  purchaseHistory: admin.firestore.FieldValue.arrayUnion({
                                      packageId,
                                      creditAmount,
                                      pricePaid: priceInCents,
                                      purchaseDate: new Date() // Use regular Date instead of server timestamp
                                  }),
                                  lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                              });
                          }
                          
                          console.log(`[Credits] Successfully added ${creditAmount} credits for user ${userId}`);
                      } catch (error) {
                          console.error(`[Credits Error] Failed to add credits: ${error}`);
                          // Still return success to Stripe but log the error
                          res.status(200).send({ received: true, error: 'Failed to add credits' });
                          return;
                               }
                          } else {
                      console.log(`[Credits] Payment not completed: ${session.payment_status}`);
                  }
                  
                  // Acknowledge receipt of the event
                  res.status(200).send({ received: true, type: 'credit_purchase' });
                  return;
                  } else {
                  // Unknown checkout type
                  console.log(`[Webhook] Unrecognized checkout type. Session ID: ${session.id}`);
                  res.status(200).send({ received: true, type: 'unknown' });
                  return;
              }
          } else {
              // Other event types can be handled here if needed
              console.log(`[Webhook] Received non-checkout event: ${event.type}`);
              res.status(200).send({ received: true, type: event.type });
              return;
          }
      } catch (error) {
          console.error('[Webhook Error] Failed to process webhook:', error);
          if (error instanceof Error) {
            console.error('[Webhook Error Details]', error.message);
          }
          res.status(500).send({ error: 'Internal server error during webhook processing' });
          return;
      }
  }
);

// Callable function to send welcome email (to be called after user registration)
export const sendWelcomeEmailNotification = onCall({
  secrets: [
    AWS_ACCESS_KEY_ID, // Use updated variable name
    AWS_SECRET_ACCESS_KEY, // Use updated variable name
    AWS_REGION, // Use updated variable name
    SENDER_EMAIL_ADDRESS // Use updated variable name
  ],
}, async (request) => {
  // Verbose logging for debugging
  console.log('[Email Debug] Welcome email function called. Request Auth:', JSON.stringify(request.auth));
  console.log('[Email Debug] Request Data:', JSON.stringify(request.data));
  
  // console.log('[Email Debug] Using AWS credentials:', {
  //   region: AWS_REGION.value(),
  //   sender: SENDER_EMAIL_ADDRESS.value(),
  //   keyIdPrefix: AWS_ACCESS_KEY_ID.value().substring(0, 5) + '...' // Log only the prefix for security
  // });
  
  // Verify authentication
  if (!request.auth || !request.auth.token) {
    console.error('[Email] Unauthorized attempt to send welcome email or token missing.');
    throw new HttpsError('unauthenticated', 'User must be authenticated and token must be present.');
  }
  
  // Get user details
  const userEmail = request.auth.token.email;
  if (!userEmail) {
    console.error('[Email] User email is required but not found in auth token');
    throw new HttpsError('invalid-argument', 'User email not found in auth token.');
  }
  
  // Prioritize displayName from client data, then from auth token.
  let finalDisplayName = request.data?.displayName || request.auth.token.name;
  
  console.log(`[Email Debug] Attempting to use displayName: '${finalDisplayName}' for user: ${userEmail}. request.data?.displayName was '${request.data?.displayName}', request.auth.token.name was '${request.auth.token.name}'.`);

  // The email-service's sendWelcomeEmail function has its own fallback "there" if finalDisplayName is undefined or empty.

  try {
    // Pass the determined email and displayName to the email service
    const success = await sendWelcomeEmail(userEmail, finalDisplayName); 
    if (success) {
      console.log(`[Email] Welcome email successfully queued for ${userEmail}`);
      return { success: true, message: "Welcome email sent." };
    } else {
      console.error(`[Email] sendWelcomeEmail returned false for ${userEmail}. Check email-service logs.`);
      throw new HttpsError('internal', 'Failed to send welcome email via email service.');
    }
  } catch (error: any) {
    console.error(`[Email] Error in sendWelcomeEmailNotification for ${userEmail}:`, error.message, error.stack);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', `Error processing welcome email: ${error.message}`);
  }
});

// Callable function to submit contact form
export const submitContactForm = onCall({
  secrets: [
    AWS_ACCESS_KEY_ID, // Use updated variable name
    AWS_SECRET_ACCESS_KEY, // Use updated variable name
    AWS_REGION, // Use updated variable name
    SENDER_EMAIL_ADDRESS // Use updated variable name
  ],
}, async (request) => {
  // Extract data from request
  const { name, email, subject, message } = request.data;
  
  // Validate input
  if (!name || !email || !subject || !message) {
    console.error('[Contact Form] Missing required information', request.data);
    throw new Error('Please fill in all required fields');
  }
  
  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('[Contact Form] Invalid email format:', email);
    throw new Error('Please enter a valid email address');
  }
  
  console.log(`[Contact Form] Processing submission from ${name} (${email})`);
  
  try {
    // Send contact form email
    const result = await sendContactFormEmail(name, email, subject, message);
    
    if (result) {
      console.log(`[Contact Form] Successfully sent message from ${email}`);
      return { success: true, message: 'Your message has been sent. We will get back to you soon!' };
    } else {
      console.error(`[Contact Form] Failed to send message from ${email}`);
      throw new Error('Failed to send your message. Please try again later.');
    }
  } catch (error) {
    console.error('[Contact Form] Error processing contact form:', error);
    throw new Error('An error occurred while processing your message. Please try again later.');
  }
});

// Helper for memory management
function cleanupMemory(): Promise<void> {
    // Set a small delay to allow garbage collection to run
    return new Promise<void>(resolve => {
        setTimeout(() => {
            resolve();
        }, 100);
    });
}

// --- Watermarking Helper ---
async function applyWatermark(originalImageBuffer: Buffer): Promise<Buffer> {
    console.log(`[applyWatermark] Starting. Input buffer size: ${originalImageBuffer.length}`);
    // Adjust SVG size and style for a more prominent watermark
    // Try simplifying the SVG drastically for parsing robustness - using inline styles
    const watermarkSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024">
        <g transform="rotate(-30 512 512)">
          <text 
            x="50%" 
            y="30%" 
            text-anchor="middle" 
            dominant-baseline="middle" 
            font-family="sans-serif"
            font-size="162"
            font-weight="900"
            fill="rgba(0,0,0,0.4)"
          >PREVIEW</text>
          <text 
            x="50%" 
            y="62%" 
            text-anchor="middle" 
            dominant-baseline="middle" 
            font-family="sans-serif"
            font-size="162"
            font-weight="900"
            fill="rgba(0,0,0,0.4)"
          >storyincolor.com</text>
        </g>
      </svg>`;
    const watermarkBuffer = Buffer.from(watermarkSvg);
    console.log(`[applyWatermark] SVG created (inline styles). Watermark buffer size: ${watermarkBuffer.length}`);

    try {
        console.log("[applyWatermark] Attempting sharp composite...");
        // Create a pipeline to process the image in one step to reduce memory copies
        const watermarkedBuffer = await sharp(originalImageBuffer)
            .composite([{
                input: watermarkBuffer,
                gravity: 'center', // Center the watermark
            }])
            .jpeg({ quality: 85 }) // Always output as JPEG with slight compression
            .toBuffer();
        console.log(`[applyWatermark] Composite successful. Output buffer size: ${watermarkedBuffer.length}`);
        return watermarkedBuffer;
    } catch (error: any) { // Explicitly type error as any to access message
        console.error("[applyWatermark] Error applying watermark:", error);
        // Re-throw as HttpsError for consistent error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new HttpsError('internal', `Failed to apply watermark: ${errorMessage}`);
    }
}

// --- New OpenAI Image Processing Function ---
export const processImageWithOpenAI = onCall(
    {
        secrets: [OPENAI_API_KEY],
        timeoutSeconds: 300,
        memory: '4GiB', // Increased from 2GiB to 4GiB to prevent memory limit errors
    },
    async (request) => {
        console.log("processImageWithOpenAI called.");
        if (!request.auth) {
            console.error('[Auth Error] User not authenticated.');
            throw new HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const userId = request.auth.uid;
        const { projectId, pageId, originalImageStoragePath, artStyle } = request.data;

        // Validate input
        if (!projectId || !pageId || !originalImageStoragePath || !artStyle) {
            console.error('[Validation Error] Missing required data:', { projectId, pageId, originalImageStoragePath, artStyle });
            throw new HttpsError('invalid-argument', 'Missing required data: projectId, pageId, originalImageStoragePath, artStyle.');
        }
        console.log("Input validated:", { userId, projectId, pageId, artStyle, originalImageStoragePath });

        // Initialize OpenAI client with more detailed logging
        // @ts-ignore: openai is initialized but not directly used
        let openai: OpenAI;
        try {
            const apiKey = OPENAI_API_KEY.value();
            console.log("OpenAI API Key retrieved (length):", apiKey ? apiKey.length : 'undefined/null');
            console.log("OpenAI API Key first 4 chars:", apiKey?.substring(0, 4));
            
            if (!apiKey || apiKey.trim() === '') {
                console.error('[OpenAI Error] Empty or missing API key');
                throw new HttpsError('internal', 'Invalid OpenAI API configuration');
            }
            
            openai = new OpenAI({
                apiKey: apiKey,
            });
            console.log("OpenAI client initialized successfully");
        } catch (error) {
            console.error('[OpenAI Error] Failed to initialize OpenAI client:', error);
            throw new HttpsError('internal', 'Failed to initialize OpenAI');
        }

        const versionId = uuidv4(); // Generate unique ID for this version
        // Create two different timestamp variables
        const timestampForUpdate = admin.firestore.FieldValue.serverTimestamp();
        const timestampForArray = new Date(); // Regular JavaScript Date for use inside arrays

        // Define storage paths for this version
        const basePath = `users/${userId}/projects/${projectId}/pages/${pageId}/versions/${versionId}`;
        const originalOutputPath = `${basePath}_original.b64`; // Store raw b64 response
        const watermarkedOutputPath = `${basePath}_watermarked.png`; // Store watermarked PNG

        console.log("Defined paths:", { originalOutputPath, watermarkedOutputPath });

        try {
            // 1. Fetch original image
            console.log(`Fetching original image from: ${originalImageStoragePath}`);
            const originalFile = bucket.file(originalImageStoragePath);
            const [originalImageBuffer] = await originalFile.download();
            console.log(`Original image fetched. Size: ${originalImageBuffer.length} bytes`);

            // Store buffer in a property that can be cleaned up (don't modify the constant)
            (global as any).__temp_originalBuffer = originalImageBuffer;

            // <<< Optimization: More aggressive resize to reduce memory usage >>>
            console.log("Resizing input image buffer with more aggressive settings...");
            const resizedImageBuffer = await sharp(originalImageBuffer)
                .resize({ 
                    width: 1024,  // Reduced from 2048 to 1024
                    height: 1024, // Reduced from 2048 to 1024
                    fit: sharp.fit.inside,
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 65 }) 
                .toBuffer();
                
            // Clear references to free memory - don't modify the constant itself
            (global as any).__temp_originalBuffer = null;
            await cleanupMemory();
            
            console.log(`Resized input image buffer. New size: ${resizedImageBuffer.length} bytes`);
            
            // Determine prompt based on artStyle
            let prompt: string;
            if (artStyle === 'ghibli') {
                prompt = "Convert this photo into a clean black-and-white line illustration suitable for a coloring book. Use Ghibli style. If there are faces or figures, maintain the original features and essence, but subtly enhance them to appear sweeter, softer, and more charming—like a gently idealized animated style. Use thin, elegant lines with no shading or poche-style hatching. Simplify background details if needed, but preserve the overall mood and composition. The final image should feel graceful, warm, and beautiful, with a soft and uplifting tone.";
            } else { // Default to 'classic' or any other style
                prompt = "Convert this photo into a clean black-and-white line illustration suitable for a coloring book. If there are faces or figures, maintain the original features and essence, but subtly enhance them to appear sweeter, softer, and more charming—like a gently idealized animated style. Use thin, elegant lines with no shading or poche-style hatching. Simplify background details if needed, but preserve the overall mood and composition. The final image should feel graceful, warm, and beautiful, with a soft and uplifting tone.";
            }
            console.log(`Using prompt for style '${artStyle}': "${prompt}"`);
            
            // Set up the image input for OpenAI using gpt-image-1
            console.log("Calling OpenAI API with prompt:", prompt);

            // Store resized buffer for possible cleanup
            (global as any).__temp_resizedBuffer = resizedImageBuffer;

            try {
                // Call OpenAI API
                console.log("Using OpenAI client with gpt-image-1 model");
                
                // Direct API call with proper Node.js FormData DO NOT CHANGE THIS
                const formData = new FormData();
                formData.append('model', 'gpt-image-1');
                formData.append('prompt', prompt);
                formData.append('n', '1');
                formData.append('size', '1024x1536');
                formData.append('quality', 'auto');

                // Log what we're appending to see it in the logs
                console.log("Appending image to FormData, size:", resizedImageBuffer.length);
                // Form-data expects key name without [] for Node.js usage
                formData.append('image', resizedImageBuffer, {
                    filename: 'image.jpg',
                    contentType: 'image/jpeg',
                });

                // Log the form data headers to debug
                console.log("FormData headers:", formData.getHeaders());

                console.log("Sending OpenAI API request with FormData");

                // Prepare headers including multipart boundary
                const headers = {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${OPENAI_API_KEY.value()}`,
                };
                const response = await fetch('https://api.openai.com/v1/images/edits', {
                    method: 'POST',
                    headers,
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("OpenAI API error response:", errorText);
                    throw new Error(`OpenAI API call failed: ${response.status} ${response.statusText} - ${errorText}`);
                }

                const responseData = await response.json();
                console.log("OpenAI API response received successfully");
                console.log("Response structure:", JSON.stringify({
                    data: responseData.data ? {
                        length: responseData.data.length,
                        first_item_keys: responseData.data[0] ? Object.keys(responseData.data[0]) : null
                    } : null
                }));
                
                // Clean up resized buffer after API call
                (global as any).__temp_resizedBuffer = null;
                await cleanupMemory();
                
                if (!responseData.data || responseData.data.length === 0) {
                    console.error("OpenAI API did not return valid image data");
                    throw new HttpsError('internal', 'OpenAI API failed to generate image data');
                }
                
                // For gpt-image-1, the response will always include b64_json
                const b64Json = responseData.data[0].b64_json;
                if (!b64Json) {
                    console.error("Unexpected response format, missing b64_json:", responseData.data[0]);
                    throw new HttpsError('internal', 'OpenAI API returned unexpected response format');
                }
                
                // Convert base64 to buffer
                console.log("Processing b64_json response from gpt-image-1");
                const imageBuffer = Buffer.from(b64Json, 'base64');
                console.log("Generated image buffer from base64, size:", imageBuffer.length);
                
                // Save the original image to Storage
                console.log(`Saving original image to: ${originalOutputPath}`);
                await bucket.file(originalOutputPath).save(imageBuffer, { contentType: 'image/png' });
                console.log("Original image saved");
                
                // Apply watermark
                console.log("Applying watermark...");
                const watermarkedImageBuffer = await applyWatermark(imageBuffer);
                console.log("Watermark applied");
                
                // Save watermarked image
                console.log(`Saving watermarked image to: ${watermarkedOutputPath}`);
                await bucket.file(watermarkedOutputPath).save(watermarkedImageBuffer, { contentType: 'image/png' });
                console.log("Watermarked image saved");
                
                // 5. Update Firestore with version info
                console.log(`Updating Firestore for project: ${projectId}`);
                const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
                
                // Create new version data
                const newVersionData = {
                    versionId: versionId,
                    createdAt: timestampForArray, // Use regular Date inside arrays
                    originalStoragePath: originalOutputPath,
                    watermarkedStoragePath: watermarkedOutputPath,
                    artStyle: artStyle, // Add artStyle used for this version
                };
                
                // Get current project data
                const projectSnap = await projectRef.get();
                if (!projectSnap.exists) {
                    throw new HttpsError('not-found', `Project ${projectId} not found`);
                }
                
                const projectData = projectSnap.data() as any;
                const currentPages = projectData.pages || [];
                
                // Find page to update
                const pageIndex = currentPages.findIndex((p: any) => p.id === pageId);
                if (pageIndex === -1) {
                    throw new HttpsError('not-found', `Page ${pageId} not found in project`);
                }
                
                // Get current versions
                const currentVersions = currentPages[pageIndex].versions || [];
                
                // Update the page with new version
                const updatedVersions = [...currentVersions, newVersionData];
                currentPages[pageIndex] = {
                    ...currentPages[pageIndex],
                    versions: updatedVersions,
                    selectedVersionId: versionId,
                    isProcessing: false,
                    processingError: null,
                };
                
                // Update Firestore
                await projectRef.update({
                    pages: currentPages,
                    updatedAt: timestampForUpdate, // Use serverTimestamp for top-level field
                });
                
                console.log("Firestore document updated successfully");
                
                // 6. Return success with version info
                return {
                    success: true,
                    message: "Image processed successfully",
                    newVersion: newVersionData,
                    watermarkedUrl: `https://storage.googleapis.com/${bucket.name}/${watermarkedOutputPath}`,
                };
                
            } catch (openaiError: any) {
                console.error("OpenAI API call failed:", openaiError.message);
                // Clean up resized buffer on error
                (global as any).__temp_resizedBuffer = null;
                await cleanupMemory();
                throw new HttpsError('internal', `OpenAI API call failed: ${openaiError.message}`);
            }
            
        } catch (error: any) {
            console.error('[OpenAI Error] Failed to process image:', error.message);
            
            // Clean up any global temp references
            Object.keys(global)
                .filter(key => key.startsWith('__temp_'))
                .forEach(key => {
                    (global as any)[key] = null;
                    delete (global as any)[key];
                });
                
            await cleanupMemory();
            
            throw new HttpsError('internal', `Failed to process image: ${error.message}`);
        }
    }
);

// Function to generate a download URL for a PDF
export const getPdfDownloadUrl = onCall({
  secrets: [STRIPE_SECRET_KEY], // Using the same secrets config as other endpoints
}, async (request) => {
  console.log("[DownloadURL] Function called for generating PDF download URL");
  
  // Verify authentication
  if (!request.auth) {
    console.error('[DownloadURL] Unauthorized attempt to get PDF URL');
    throw new HttpsError('unauthenticated', 'User must be authenticated to access PDFs');
  }
  
  const userId = request.auth.uid;
  const { projectId } = request.data;
  
  // Validate input
  if (!projectId) {
    console.error('[DownloadURL] Missing required field: projectId');
    throw new HttpsError('invalid-argument', 'Missing required field: projectId');
  }
  
  try {
    // Get project to verify ownership and get PDF path
    console.log(`[DownloadURL] Fetching project ${projectId} for user ${userId}`);
    const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    
    if (!projectSnap.exists) {
      console.error(`[DownloadURL] Project ${projectId} not found for user ${userId}`);
      throw new HttpsError('not-found', 'Project not found');
    }
    
    const projectData = projectSnap.data();
    const pdfStoragePath = projectData?.pdfStoragePath;
    
    if (!pdfStoragePath) {
      console.error(`[DownloadURL] Project ${projectId} does not have a PDF yet`);
      throw new HttpsError('failed-precondition', 'Project does not have a PDF yet');
    }
    
    // Generate a download URL
    console.log(`[DownloadURL] Generating download URL for path: ${pdfStoragePath}`);
    const pdfFile = bucket.file(pdfStoragePath);
    
    // Check if file exists
    const [exists] = await pdfFile.exists();
    if (!exists) {
      console.error(`[DownloadURL] PDF file does not exist at path: ${pdfStoragePath}`);
      throw new HttpsError('not-found', 'PDF file not found in storage');
    }
    
    // Set metadata to make the file accessible via download URL
    await pdfFile.setMetadata({
      metadata: {
        'isCompletedPdf': 'true'
      }
    });
    
    // Create a download URL
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(pdfStoragePath)}?alt=media`;
    
    console.log(`[DownloadURL] Generated download URL successfully`);
    
    // Update the project with the new download URL
    await projectRef.update({
      pdfUrl: downloadUrl,
      pdfUrlGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      pdfUrl: downloadUrl
    };
  } catch (error) {
    console.error('[DownloadURL] Error generating download URL:', error);
    throw new HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to generate download URL'
    );
  }
});

/**
 * Creates a Stripe checkout session for credit purchase
 */
export const createCreditCheckout = onCall<{packageId: string, origin?: string}>(
  {
    secrets: [STRIPE_SECRET_KEY],
    labels: {
      "deployment-callable": "true"
    }
  },
  async (request) => {
    console.log("[createCreditCheckout] Function called with request:", request.data);
    
    // Verify auth context is present
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to purchase credits');
    }
    
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;
    console.log(`[Auth] User authenticated: ${userId}`);

    // Extract packageId from data
    const { packageId, origin } = request.data;
    console.log("[Request Body] Received packageId:", packageId);
    console.log("[Request Body] Received origin:", origin);

    // Validate packageId
    if (!packageId) {
      console.error('[Validation Error] Missing required field: packageId');
      throw new HttpsError('invalid-argument', 'Missing required field: packageId');
    }

    try {
      // Find the credit package
      const creditPackage = CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
      if (!creditPackage) {
        console.error(`[Validation Error] Invalid credit package: ${packageId}`);
        throw new HttpsError('invalid-argument', 'Invalid credit package selected');
      }
      
      // Initialize Stripe
      console.log("[Stripe] Initializing Stripe client.");
      
      // Fetch the secret and apply stronger validation
      let stripeKey = STRIPE_SECRET_KEY.value();
      
      // Check if key matches expected format pattern (sk_live_... or sk_test_...)
      const isValidStripeKeyFormat = /^sk_(live|test)_[A-Za-z0-9_]+$/.test(stripeKey);
      console.log(`[Stripe] Secret key format valid: ${isValidStripeKeyFormat}`);
      
      if (!isValidStripeKeyFormat) {
        console.error('[Stripe] API key has invalid format - this will cause auth errors');
        // Try to sanitize by removing all non-ASCII characters
        const originalLength = stripeKey.length;
        stripeKey = stripeKey.replace(/[^\x20-\x7E]/g, '');
        console.log(`[Stripe] Sanitized key: removed ${originalLength - stripeKey.length} non-ASCII chars`);
      }
      
      // Log a sanitized version (first 8 chars) for debugging
      console.log(`[Stripe] Secret key prefix: ${stripeKey.substring(0, 8)}... (length: ${stripeKey.length})`);
      
      const stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16',
      });

      // Create product name and description
      const productName = `${creditPackage.credits} Credits`;
      const productDescription = `${creditPackage.credits} credits for generating coloring pages (${creditPackage.discountPercentage}% discount)`;

      // Create line items
      const lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: creditPackage.price,
        },
        quantity: 1,
      }];
      console.log("[Stripe] Prepared line items.");

      // Determine domain for success/cancel URLs - use provided origin or default to production
      const domain = origin || 'https://storyincolor.com';
      console.log(`[Stripe] Using domain for redirects: ${domain}`);
      
      // Create checkout session
      console.log("[Stripe] Creating checkout session...");
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            setup_future_usage: 'off_session',
            request_three_d_secure: 'automatic'
          }
        },
        payment_intent_data: {
          capture_method: 'automatic',
        },
        billing_address_collection: 'auto', 
        line_items: lineItems,
        mode: 'payment',
        locale: 'en',
        client_reference_id: userId,
        customer_email: userEmail || undefined,
        metadata: { 
          userId,
          packageId,
          creditAmount: String(creditPackage.credits),
          priceInCents: String(creditPackage.price),
          type: 'credit_purchase'
        },
        success_url: `${domain}/dashboard?credit_purchase=success`,
        cancel_url: `${domain}/credits`,
      });
      console.log(`[Stripe] Checkout session created successfully: ${session.id}`);

      // Return the session ID 
      return { sessionId: session.id };

    } catch (error) {
      console.error('[Stripe Error] Failed to create checkout session:', error);
      if (error instanceof Error && 'type' in error) {
          console.error('[Stripe Error Details]', { type: (error as any).type, code: (error as any).code, message: error.message });
      }
      throw new HttpsError('internal', 'Failed to create checkout session');
    }
  }
);

/**
 * Generates a PDF for a project without requiring payment
 */
export const generateProjectPDF = onCall(
  {
    timeoutSeconds: 300,
    memory: '4GiB',
  },
  async (request) => {
    console.log("[generateProjectPDF] Function called with request:", request.data);
    
    // Verify auth context
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to generate PDF');
    }
    
    const userId = request.auth.uid;
    console.log(`[Auth] User authenticated: ${userId}`);

    // Extract projectId from data
    const { projectId } = request.data;
    
    // Validate projectId
    if (!projectId) {
      console.error('[Validation Error] Missing required field: projectId');
      throw new HttpsError('invalid-argument', 'Missing required field: projectId');
    }
    
    try {
      console.log(`[PDF] Starting PDF generation for project ${projectId}`);
      
      // Check if the user has ever purchased credits
      const userCreditsRef = db.collection('userCredits').doc(userId);
      console.log(`[PDF] Checking credit history for user: ${userId}`);
      const userCreditsDoc = await userCreditsRef.get();
      
      let hasPurchasedCredits = false;
      
      // Extra debugging for the userCreditsDoc
      console.log(`[PDF-DEBUG] userCreditsDoc exists: ${userCreditsDoc.exists}`);
      
      if (userCreditsDoc.exists) {
        const userData = userCreditsDoc.data();
        console.log(`[PDF] User credit data found:`, JSON.stringify({
          balance: userData?.balance,
          used: userData?.used,
          purchaseHistoryCount: userData?.purchaseHistory?.length || 0
        }));
        
        // Check if user has any PAID purchase history (not just the initial free credits)
        if (userData?.purchaseHistory && userData.purchaseHistory.length > 0) {
          // Look for any purchase that is not marked as initial free credits
          const paidPurchases = userData.purchaseHistory.filter(
            (purchase: any) => !purchase.isInitialCredits && purchase.pricePaid > 0
          );
          
          console.log(`[PDF] User purchase history: total=${userData.purchaseHistory.length}, paid=${paidPurchases.length}`);
          console.log(`[PDF] Paid purchases:`, JSON.stringify(paidPurchases));
          
          if (paidPurchases.length > 0) {
            hasPurchasedCredits = true;
            console.log(`[PDF] User has purchased credits before. Using high-quality images.`);
          } else {
            console.log(`[PDF] User has only free initial credits. Using watermarked images.`);
          }
        } else {
          console.log(`[PDF] User has never purchased credits. Using watermarked images.`);
        }
      } else {
        console.log(`[PDF] No credit record found for user. Using watermarked images.`);
      }
      
      // Debug: Log what type of images will be used
      console.log(`[PDF] Will use ${hasPurchasedCredits ? 'HIGH QUALITY' : 'WATERMARKED'} images for PDF`);

      // Reference to the Firestore project document
      const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
      
      // Get project data
      const projectSnapshot = await projectRef.get();
      if (!projectSnapshot.exists) {
        throw new HttpsError('not-found', `Project ${projectId} not found for user ${userId}`);
      }
      
      const projectData = projectSnapshot.data();
      
      // Verify project has pages
      const pages = projectData?.pages || [];
      if (pages.length === 0) {
        throw new HttpsError('failed-precondition', 'Project has no pages to include in PDF');
      }
      
      console.log(`[PDF] Project has ${pages.length} pages to include in PDF`);
      
      // Create PDF filename
      const pdfFilename = `${projectData?.title || 'Coloring_Book'}_${new Date().getTime()}.pdf`;
      const pdfStoragePath = `users/${userId}/projects/${projectId}/downloads/${pdfFilename}`;
      
      console.log(`[PDF] Created filename: ${pdfFilename}`);
      console.log(`[PDF] Storage path: ${pdfStoragePath}`);
      
      // Create temp directory for PDF generation
      const tempDir = os.tmpdir();
      const tempPdfPath = path.join(tempDir, pdfFilename);
      console.log(`[PDF] Using temp path: ${tempPdfPath}`);
      
      // Create PDF document
      const doc = new PDFDocument({
        size: 'letter', // Use letter size
        margin: 36, // 0.5 inch margins
      });
      
      // Create write stream for PDF
      const writeStream = fs.createWriteStream(tempPdfPath);
      doc.pipe(writeStream);
      
      // Add title page
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(projectData?.title || 'My Coloring Pages', {
             align: 'center'
         })
         .moveDown(0.5)
         .fontSize(16)
         .font('Helvetica')
         .text('storyincolor.com', {
             align: 'center',
             continued: false
         })
         .moveDown(2);
      
      // Add printing instructions
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Printing Instructions:', {
             align: 'left',
             continued: false
         })
         .moveDown(0.5)
         .fontSize(12)
         .font('Helvetica')
         .text('1. Use high-quality paper for best results', {
             align: 'left',
             continued: false
         })
         .moveDown(0.5)
         .text('2. For best results, use "Fit to page" in your printer settings', {
             align: 'left',
             continued: false
         })
         .moveDown(2)
         .fontSize(12)
         .text(`Generated on ${new Date().toLocaleDateString()}`, {
             align: 'center',
             continued: false
         });
         
      // Add QR code for the website - centered on page
      // Use QR code from frontend public folder
      const qrCodeUrl = 'https://storyincolor.com/images/qr-code.png'; // URL to the QR code in public images folder
      // Calculate position to center the QR code
      const pageWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);
      const qrSize = 150; // QR code size in pixels
      const qrX = doc.page.margins.left + (pageWidth - qrSize) / 2;
      
      // Center the QR code vertically, but position it a bit higher
      // Calculate vertical center position with adjustment
      const currentY = doc.y;
      const remainingHeight = doc.page.height - doc.page.margins.bottom - currentY;
      
      // Adjust the spacing to position QR code higher (reduce top space by 30%)
      const idealSpacerHeight = (remainingHeight - qrSize) / 2;
      const topSpacerHeight = idealSpacerHeight * 0.7; // Reduce top space to move QR code higher
      
      // Try to use the QR code image, with text fallback if it fails
      try {
        // Download the QR code to a temp file
        const qrCodeTempPath = path.join(tempDir, 'qr-code.png');
        console.log(`[PDF] Downloading QR code from ${qrCodeUrl} to ${qrCodeTempPath}`);
        
        // Use node-fetch to download the image
        const response = await fetch(qrCodeUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch QR code: ${response.status} ${response.statusText}`);
        }
        
        const imageBuffer = await response.arrayBuffer();
        fs.writeFileSync(qrCodeTempPath, Buffer.from(imageBuffer));
        
        // Add space to position the QR code (reduced to move it higher)
        doc.moveDown(topSpacerHeight / doc.currentLineHeight());
        
        // Use the downloaded file in the PDF
        doc.image(qrCodeTempPath, qrX, doc.y, { width: qrSize });
           
        // Cleanup temp file
        fs.unlinkSync(qrCodeTempPath);
      } catch (error) {
        console.error('[PDF] Error adding QR code image, falling back to text:', error);
        // Fallback to text if image fails
        doc.moveDown(topSpacerHeight / doc.currentLineHeight());
        doc.fontSize(14)
           .text('Visit storyincolor.com?source=pdf', {
               align: 'center'
           });
      }
           
      // Add watermark notice for free users at the bottom of the page
      if (!hasPurchasedCredits) {
         // Position at the bottom of page (adjusted for QR code's new position)
         const bottomSpace = remainingHeight - topSpacerHeight - qrSize - 80;
         doc.moveDown(bottomSpace / doc.currentLineHeight());
         
         doc.rect(doc.page.margins.left, doc.y, pageWidth, 80)
            .fill('#ffeeee');
            
         doc.moveDown(0.3)
            .fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#cc0000')
            .text('FREE VERSION NOTICE', {
                align: 'center'
            })
            .moveDown(0.5)
            .fontSize(12)
            .font('Helvetica')
            .text('This free PDF contains watermarked preview images.', {
                align: 'center',
                continued: false
            })
            .moveDown(0.3)
            .text('Purchase credits to generate high-quality PDFs without watermarks.', {
                align: 'center'
            })
            .fillColor('#000000');
      }
      
      doc.addPage();
      
      // Process each page and add to PDF
      console.log(`[PDF] Adding pages to PDF document`);
      
      // Function to download and process image
      async function downloadImage(storagePath: string): Promise<Buffer> {
          console.log(`[PDF] Downloading image from ${storagePath}`);
          const file = bucket.file(storagePath);
          const [buffer] = await file.download();
          return buffer;
      }
      
      // Organize all images - both selected and unselected
      const selectedImages: {index: number, pageNumber: number, buffer: Buffer}[] = [];
      const unselectedImages: {pageIndex: number, pageNumber: number, versionIndex: number, buffer: Buffer}[] = [];
      
      // Sort pages array by pageNumber before processing
      const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
      console.log(`[PDF] Sorted ${pages.length} pages by pageNumber before processing`);

      // Use Promise.all to download all images in parallel
      const downloadPromises = sortedPages.map(async (page: any, pageIndex: number) => {
          try {
              // Get selected version (or first if none selected)
              const selectedVersionId = page.selectedVersionId;
              const versions = page.versions || [];
              
              if (versions.length === 0) {
                  console.log(`[PDF] Page ${page.pageNumber} has no versions, skipping`);
                  return null;
              }
              
              // Process selected version
              const selectedVersion = versions.find((v: any) => v.versionId === selectedVersionId) || versions[0];
              
              // Use the appropriate image path based on user's purchase history
              let selectedStoragePath;
              console.log(`[PDF-DEBUG] hasPurchasedCredits=${hasPurchasedCredits} for path selection`);
              if (hasPurchasedCredits) {
                  // Paid users get original (non-watermarked) images
                  selectedStoragePath = selectedVersion.originalStoragePath;
                  console.log(`[PDF] Using original image for paid user on page ${page.pageNumber}`);
              } else {
                  // Free users get watermarked preview images
                  selectedStoragePath = selectedVersion.watermarkedStoragePath;
                  console.log(`[PDF] Using watermarked image for free user on page ${page.pageNumber}`);
              }
              
              if (!selectedStoragePath) {
                  console.log(`[PDF] No storage path found for selected version on page ${page.pageNumber}, skipping`);
                  return null;
              }
              
              console.log(`[PDF] Processing selected version for page ${page.pageNumber}, using version ${selectedVersion.versionId}`);
              
              // Download the selected image
              const selectedImageBuffer = await downloadImage(selectedStoragePath);
              selectedImages.push({ index: pageIndex, pageNumber: page.pageNumber, buffer: selectedImageBuffer });
              
              // Process unselected versions
              const unselectedVersionPromises = versions
                  .filter((v: any) => v.versionId !== selectedVersionId)
                  .map(async (unselectedVersion: any, versionIndex: number) => {
                      let unselectedStoragePath;
                      if (hasPurchasedCredits) {
                          unselectedStoragePath = unselectedVersion.originalStoragePath;
                      } else {
                          unselectedStoragePath = unselectedVersion.watermarkedStoragePath;
                      }
                      
                      if (!unselectedStoragePath) {
                          console.log(`[PDF] No storage path found for unselected version ${unselectedVersion.versionId} on page ${page.pageNumber}, skipping`);
                          return null;
                      }
                      
                      console.log(`[PDF] Processing unselected version ${unselectedVersion.versionId} for page ${page.pageNumber}`);
                      
                      // Download the unselected image
                      const unselectedImageBuffer = await downloadImage(unselectedStoragePath);
                      return { pageIndex, pageNumber: page.pageNumber, versionIndex, buffer: unselectedImageBuffer };
                  });
              
              // Wait for all unselected versions to download
              const unselectedResults = await Promise.all(unselectedVersionPromises);
              unselectedResults.filter(result => result !== null).forEach(result => {
                  unselectedImages.push(result);
              });
              
              return true; // Indicate that this page was processed
          } catch (pageError) {
              console.error(`[PDF] Error processing page ${page.pageNumber}:`, pageError);
              return null;
          }
      });
      
      // Wait for all downloads to complete
      await Promise.all(downloadPromises);
      
      console.log(`[PDF] Downloaded ${selectedImages.length} selected images and ${unselectedImages.length} unselected images`);
      
      // Sort the selected images by pageNumber to ensure correct order in PDF
      selectedImages.sort((a, b) => a.pageNumber - b.pageNumber);
      console.log("[PDF] Sorted selected images by pageNumber before writing to PDF");

      // Also sort unselected images by pageNumber and then versionIndex
      unselectedImages.sort((a, b) => 
        a.pageNumber === b.pageNumber 
          ? a.versionIndex - b.versionIndex 
          : a.pageNumber - b.pageNumber
      );
      console.log("[PDF] Sorted unselected images by pageNumber and versionIndex before writing to PDF");

      // Add each selected image to the PDF
      for (let i = 0; i < selectedImages.length; i++) {
          const imageResult = selectedImages[i];
          
          // Always add a new page after the title page (which is page 1)
          // But don't add an extra page before the first image
          if (i > 0) {
              doc.addPage();
          }
          
          try {
              // Get image dimensions
              const metadata = await sharp(imageResult.buffer).metadata();
              const width = metadata.width || 1024;
              const height = metadata.height || 1024;
              
              // Calculate aspect ratio
              const imgAspect = width / height;
              const pageWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);
              const pageHeight = doc.page.height - (doc.page.margins.top + doc.page.margins.bottom);
              const pageAspect = pageWidth / pageHeight;
              
              // Determine dimensions to fit image on page while maintaining aspect ratio
              let finalWidth, finalHeight;
              if (imgAspect > pageAspect) {
                  // Image is wider than page proportion
                  finalWidth = pageWidth;
                  finalHeight = pageWidth / imgAspect;
              } else {
                  // Image is taller than page proportion
                  finalHeight = pageHeight;
                  finalWidth = pageHeight * imgAspect;
              }
              
              // Calculate position to center image on page
              const xPos = doc.page.margins.left + (pageWidth - finalWidth) / 2;
              const yPos = doc.page.margins.top + (pageHeight - finalHeight) / 2;
              
              // Add image to page
              doc.image(imageResult.buffer, xPos, yPos, {
                  width: finalWidth,
                  height: finalHeight
              });
              
              console.log(`[PDF] Added selected page ${imageResult.index + 1} to PDF at position ${i + 1}`);
          } catch (renderError) {
              console.error(`[PDF] Error rendering selected page ${imageResult.index + 1}:`, renderError);
          }
      }
      
      // Add unselected images section if there are any
      if (unselectedImages.length > 0) {
          // Add separator page
          doc.addPage();
          
          // Create a separator page with text
          doc.fontSize(24)
             .font('Helvetica-Bold')
             .text('Alternative Versions', {
                 align: 'center'
             })
             .moveDown(1)
             .fontSize(14)
             .font('Helvetica')
             .text('The following pages contain alternative versions that were not selected for the main coloring book.', {
                 align: 'center'
             })
             .moveDown(0.5)
             .text('You may use these as additional coloring pages.', {
                 align: 'center'
             });
          
          // Add each unselected image
          for (const unselectedImage of unselectedImages) {
              doc.addPage();
              
              try {
                  // Get image dimensions
                  const metadata = await sharp(unselectedImage.buffer).metadata();
                  const width = metadata.width || 1024;
                  const height = metadata.height || 1024;
                  
                  // Calculate aspect ratio
                  const imgAspect = width / height;
                  const pageWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);
                  const pageHeight = doc.page.height - (doc.page.margins.top + doc.page.margins.bottom);
                  const pageAspect = pageWidth / pageHeight;
                  
                  // Determine dimensions to fit image on page while maintaining aspect ratio
                  let finalWidth, finalHeight;
                  if (imgAspect > pageAspect) {
                      // Image is wider than page proportion
                      finalWidth = pageWidth;
                      finalHeight = pageWidth / imgAspect;
                  } else {
                      // Image is taller than page proportion
                      finalHeight = pageHeight;
                      finalWidth = pageHeight * imgAspect;
                  }
                  
                  // Calculate position to center image on page
                  const xPos = doc.page.margins.left + (pageWidth - finalWidth) / 2;
                  const yPos = doc.page.margins.top + (pageHeight - finalHeight) / 2;
                  
                  // Add image to page
                  doc.image(unselectedImage.buffer, xPos, yPos, {
                      width: finalWidth,
                      height: finalHeight
                  });
                  
                  // Add a small caption
                  doc.moveDown()
                     .fontSize(10)
                     .font('Helvetica')
                     .text(`Alternative version ${unselectedImage.versionIndex + 1} for page ${unselectedImage.pageNumber}`, {
                         align: 'center'
                     });
                  
                  console.log(`[PDF] Added unselected version ${unselectedImage.versionIndex + 1} for page ${unselectedImage.pageNumber} to PDF`);
              } catch (renderError) {
                  console.error(`[PDF] Error rendering unselected version for page ${unselectedImage.pageNumber}:`, renderError);
              }
          }
      }
      
      // Finalize the PDF
      doc.end();
      
      // Wait for the PDF to be fully written
      await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
      });
      
      console.log(`[PDF] PDF created at ${tempPdfPath}`);
      
      // Upload PDF to Storage
      console.log(`[PDF] Uploading PDF to storage: ${pdfStoragePath}`);
      await bucket.upload(tempPdfPath, {
          destination: pdfStoragePath,
          metadata: {
              contentType: 'application/pdf',
              metadata: {
                  firebaseStorageDownloadTokens: uuidv4(), // Generate a download token
                  isCompletedPdf: 'true'  // Add this metadata flag to match storage rules
              }
          }
      });
      
      // Additional step to explicitly set the metadata again
      console.log(`[PDF] Setting explicit metadata on file: ${pdfStoragePath}`);
      const file = bucket.file(pdfStoragePath);
      
      // Get existing metadata to verify it was set correctly
      const [metadata] = await file.getMetadata();
      console.log(`[PDF] Current file metadata:`, JSON.stringify(metadata.metadata || {}));
      
      // Set metadata explicitly with public read flag
      await file.setMetadata({
          metadata: {
              isCompletedPdf: 'true',
              firebaseStorageDownloadTokens: uuidv4(), // Generate a new token
          }
      });
      
      // Verify metadata was set correctly
      const [updatedMetadata] = await file.getMetadata();
      console.log(`[PDF] Updated file metadata:`, JSON.stringify(updatedMetadata.metadata || {}));
      
      // Make the file publicly accessible
      console.log(`[PDF] Making file publicly accessible`);
      await file.makePublic();
      
      // Generate a public URL that doesn't require authentication
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${pdfStoragePath}`;
      console.log(`[PDF] Public URL: ${publicUrl}`);
      
      // Clean up temp file
      fs.unlinkSync(tempPdfPath);
      console.log(`[PDF] Cleaned up temp file`);
      
      // Create a download URL
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(pdfStoragePath)}?alt=media`;
      
      console.log(`[PDF] Created download URL: ${downloadUrl}`);
      
      // Update the project with PDF path
      await projectRef.update({
          pdfStoragePath: pdfStoragePath,
          pdfUrl: publicUrl,
          pdfGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Return success response with PDF URL
      return {
          success: true,
          pdfUrl: publicUrl,
          message: "PDF generated successfully"
      };
      
    } catch (error) {
      console.error(`[PDF Error] Failed to generate PDF: ${error}`);
      throw new HttpsError('internal', `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// --- Type Definitions for Admin Dashboard ---
interface AggregatedStats {
  totalUsers: number;
  totalRevenue: number; // In dollars
  payingCustomers: number;
  totalUploads: number;
  totalGenerations: number;
  totalPdfGenerations: number;
}

interface UserProjectSummary {
  id: string;
  title: string;
  pageCount: number;
}

interface EnrichedUser {
  id: string; // Firebase Auth UID
  email: string | null;
  displayName: string | null;
  createdAt: string; // ISO string format (User creation)
  disabled: boolean; // Added Auth disabled status
  deleted: boolean; // Added Firestore deleted status
  creditBalance: number;
  totalSpent: number; // In dollars
  projectCount: number;
  pdfGeneratedCount: number;
  latestProjectCreatedAt: string | null;
  projects: UserProjectSummary[];
}

interface AdminDashboardData {
  success: boolean;
  aggregatedStats: AggregatedStats;
  users: EnrichedUser[];
}

// --- Admin Dashboard Data Function (getAdminDashboardData - Enhanced) ---
export const getAdminDashboardData = onCall(
  {
    secrets: [], // Add secrets if needed later
    timeoutSeconds: 120, // Increased timeout for potentially large aggregations
    memory: '2GiB',    // Increased memory
  },
  async (request): Promise<AdminDashboardData> => {
    console.log("[getAdminDashboardData] Function called.");

    // 1. Verify admin authentication
    if (!request.auth || request.auth.token.email !== 'ipekcioglu@me.com') {
      console.error(`[Admin Dashboard] Unauthorized attempt by ${request.auth?.token.email || 'unauthenticated user'}.`);
      throw new HttpsError('permission-denied', 'Admin access required.');
    }
    console.log(`[Admin Dashboard] Admin user verified: ${request.auth.token.email}`);

    let totalUsers = 0;
    let totalRevenueCents = 0;
    let payingCustomers = 0;
    let totalUploads = 0;
    let totalGenerations = 0;
    let totalPdfGenerations = 0;
    const allAuthUsers: admin.auth.UserRecord[] = [];
    const userCreditSummaries = new Map<string, { balance: number; totalSpentCents: number }>();
    const userProjectSummaries = new Map<string, { 
      projectCount: number; 
      pdfGeneratedCount: number;
      latestProjectTimestamp: admin.firestore.Timestamp | null;
      projects: UserProjectSummary[]; 
    }>();
    const userFirestoreData = new Map<string, { deleted: boolean }>(); // Map to store Firestore deleted status

    try {
      // 2. Aggregate Data & Build Summaries
      console.log("[Admin Dashboard] Starting data aggregation...");

      // --- Fetch All Users (Auth) & Count Total ---
      console.log("[Admin Dashboard] Fetching all users from Firebase Auth...");
      let pageToken: string | undefined;
      do {
        const listUsersResult = await auth.listUsers(1000, pageToken);
        totalUsers += listUsersResult.users.length;
        allAuthUsers.push(...listUsersResult.users);
        pageToken = listUsersResult.pageToken;
      } while (pageToken);
      console.log(`[Admin Dashboard] Fetched total ${totalUsers} users from Auth.`);

      // --- Fetch Firestore User Deleted Status ---
      console.log("[Admin Dashboard] Fetching Firestore user deleted status...");
      const usersSnapshot = await db.collection('users').get();
      usersSnapshot.forEach(doc => {
          userFirestoreData.set(doc.id, { deleted: doc.data()?.deleted || false });
      });
      console.log(`[Admin Dashboard] Fetched deleted status for ${userFirestoreData.size} users from Firestore.`);

      // --- Aggregate from userCredits & Build Summaries ---
      console.log("[Admin Dashboard] Aggregating from userCredits...");
      const userCreditsSnapshot = await db.collection('userCredits').get();
      userCreditsSnapshot.forEach(doc => {
        const data = doc.data();
        let userSpentCents = 0;
        let userPaid = false;
        if (data.purchaseHistory && Array.isArray(data.purchaseHistory)) {
          data.purchaseHistory.forEach((purchase: any) => {
            if (purchase.pricePaid && purchase.pricePaid > 0 && !purchase.isInitialCredits) {
              const price = Number(purchase.pricePaid) || 0;
              totalRevenueCents += price;
              userSpentCents += price;
              userPaid = true;
            }
          });
        }
        if (userPaid) {
          payingCustomers++;
        }
        userCreditSummaries.set(doc.id, {
          balance: data.balance || 0,
          totalSpentCents: userSpentCents,
        });
      });
      const totalRevenueDollars = totalRevenueCents / 100;
      console.log(`[Admin Dashboard] Aggregated Credits - Revenue: $${totalRevenueDollars.toFixed(2)}, Paying Customers: ${payingCustomers}`);

      // --- Aggregate from projects & Build Summaries ---
      console.log("[Admin Dashboard] Aggregating from projects collection group...");
      const projectsSnapshot = await db.collectionGroup('projects').get();
      projectsSnapshot.forEach(doc => {
        const data = doc.data();
        const pathParts = doc.ref.path.split('/');
        const userId = pathParts.length > 1 ? pathParts[1] : null;
        const projectCreatedAt = data.createdAt as admin.firestore.Timestamp | undefined;

        if (userId) {
           let projectPageCount = 0;
           if (data.pages && Array.isArray(data.pages)) {
             projectPageCount = data.pages.length;
             data.pages.forEach((page: any) => {
               if (page.originalImage?.storagePath) {
                 totalUploads++;
               }
               if (page.versions && Array.isArray(page.versions)) {
                 totalGenerations += page.versions.length;
               }
             });
           }
           
           // Count total PDFs generated
           const pdfGenerated = !!data.pdfUrl || !!data.pdfGeneratedAt;
           if (pdfGenerated) {
             totalPdfGenerations++;
           }

           // Update user's project summary
           const currentUserSummary = userProjectSummaries.get(userId) || { 
               projectCount: 0, 
               pdfGeneratedCount: 0,
               latestProjectTimestamp: null,
               projects: [] 
           };
           
           currentUserSummary.projectCount++;
           if (pdfGenerated) {
             currentUserSummary.pdfGeneratedCount++;
           }

           // Track latest project timestamp for the user
           if (projectCreatedAt && (!currentUserSummary.latestProjectTimestamp || projectCreatedAt > currentUserSummary.latestProjectTimestamp)) {
             currentUserSummary.latestProjectTimestamp = projectCreatedAt;
           }

           // Only store limited project details for the list view
           if (currentUserSummary.projects.length < 10) { // Limit to e.g., 10 projects shown per user
                currentUserSummary.projects.push({ 
                    id: doc.id, 
                    title: data.title || 'Untitled Project', 
                    pageCount: projectPageCount 
                });
           }
           userProjectSummaries.set(userId, currentUserSummary);
        }
      });
      console.log(`[Admin Dashboard] Aggregated Projects - Uploads: ${totalUploads}, Generations: ${totalGenerations}, PDFs: ${totalPdfGenerations}`);

      // 3. Construct Enriched User List
      console.log("[Admin Dashboard] Constructing enriched user list...");
      const enrichedUsers: EnrichedUser[] = allAuthUsers.map(authUser => {
        const creditSummary = userCreditSummaries.get(authUser.uid) || { balance: 0, totalSpentCents: 0 };
        const projectSummary = userProjectSummaries.get(authUser.uid) || { projectCount: 0, pdfGeneratedCount: 0, latestProjectTimestamp: null, projects: [] };
        const firestoreUser = userFirestoreData.get(authUser.uid) || { deleted: false }; // Get deleted status
        
        return {
          id: authUser.uid,
          email: authUser.email || null,
          displayName: authUser.displayName || null,
          createdAt: authUser.metadata.creationTime, // ISO string (User creation)
          disabled: authUser.disabled, // Add disabled status
          deleted: firestoreUser.deleted, // Add deleted status
          creditBalance: creditSummary.balance,
          totalSpent: creditSummary.totalSpentCents / 100, // Convert to dollars
          projectCount: projectSummary.projectCount,
          pdfGeneratedCount: projectSummary.pdfGeneratedCount,
          latestProjectCreatedAt: projectSummary.latestProjectTimestamp?.toDate().toISOString() || null,
          projects: projectSummary.projects, // Contains {id, title, pageCount}
        };
      });
      console.log(`[Admin Dashboard] Constructed enriched list for ${enrichedUsers.length} users.`);
      
      console.log("[Admin Dashboard] Aggregation and data preparation complete.");

      // 4. Return Data
      return {
        success: true,
        aggregatedStats: {
          totalUsers,
          totalRevenue: totalRevenueDollars,
          payingCustomers,
          totalUploads,
          totalGenerations,
          totalPdfGenerations,
        },
        users: enrichedUsers,
      };

    } catch (error: any) {
      console.error('[Admin Dashboard] Error fetching data:', error);
      throw new HttpsError('internal', `Failed to fetch admin dashboard data: ${error.message}`);
    }
  }
);

// Add this function
export const disableCurrentUserAccount = onCall(
  {
    // Add secrets if necessary, e.g., if interacting with other services
    secrets: [],
  },
  async (request) => {
    console.log("[disableCurrentUserAccount] Function called.");

    // 1. Verify authentication
    if (!request.auth) {
      console.error('[Disable Account] Unauthorized: No authentication provided.');
      throw new HttpsError('unauthenticated', 'User must be authenticated to disable account.');
    }
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email; // For logging
    console.log(`[Disable Account] Attempting to disable account for user: ${userId} (${userEmail})`);

    try {
      // 2. Disable user in Firebase Auth
      await admin.auth().updateUser(userId, { disabled: true });
      console.log(`[Disable Account] Successfully disabled user ${userId} in Firebase Auth.`);

      // Optionally: Could also trigger the Firestore soft-delete here instead of client-side,
      // but keeping it client-side is okay since re-authentication happens there.

      return { success: true, message: "Account disabled successfully." };

    } catch (error: any) {
      console.error(`[Disable Account] Error disabling user ${userId}:`, error);
      throw new HttpsError('internal', `Failed to disable account: ${error.message}`);
    }
  }
);
