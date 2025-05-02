import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';
import { sendWelcomeEmail, sendContactFormEmail, sendProjectProcessedEmail } from './email-service';
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
import { rebuildFirestoreFromStorage } from './recovery-utils'; // Import recovery utility

// Export the recovery utility
export { rebuildFirestoreFromStorage };

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
// Only initialize db when needed
// const db = admin.firestore();
const storageClient = new Storage(); // Initialize Storage client
const bucketName = admin.app().options.storageBucket || process.env.GCLOUD_STORAGE_BUCKET;
if (!bucketName) {
    throw new Error("Storage bucket name not found. Ensure default bucket is configured or GCLOUD_STORAGE_BUCKET env var is set.");
}
const bucket = storageClient.bucket(bucketName);

/**
 * Creates a Stripe checkout session based on page count
 */
export const createStripeCheckout = onCall<{projectId: string, origin?: string}>(
  {
    secrets: [STRIPE_SECRET_KEY],
    // Add this label for Firebase to classify it as callable
    labels: {
      "deployment-callable": "true"
    }
  },
  async (request) => {
    console.log("[createStripeCheckout] Function called with request:", request.data);
    
    // Verify auth context is present
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to create checkout session');
    }
    
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email;
    console.log(`[Auth] User authenticated: ${userId}`);

    // Extract projectId from data
    const { projectId, origin } = request.data;
    console.log("[Request Body] Received projectId:", projectId);
    console.log("[Request Body] Received origin:", origin);

    // Validate projectId
    if (!projectId) {
      console.error('[Validation Error] Missing required field: projectId');
      throw new HttpsError('invalid-argument', 'Missing required field: projectId');
    }

    // Define price per page in cents
    const PRICE_PER_PAGE_CENTS = 200; // $2.00

    try {
      // Fetch project from Firestore
      console.log(`[Firestore] Fetching project ${projectId} for user ${userId}`);
      const db = admin.firestore();
      const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);
      const projectSnap = await projectRef.get();

      if (!projectSnap.exists) {
        console.error(`[Firestore Error] Project ${projectId} not found for user ${userId}`);
        throw new HttpsError('not-found', 'Project not found');
      }

      const projectData = projectSnap.data();
      const pages = projectData?.pages || [];
      const pageCount = pages.length; // Calculate pageCount from DB
      const projectTitle = projectData?.title || "Untitled Coloring Book";

      if (pageCount <= 0) {
        console.error(`[Validation Error] Project ${projectId} has no pages.`);
        throw new HttpsError('invalid-argument', 'Project has no pages to order');
      }
      console.log(`[Firestore] Found project with ${pageCount} pages.`);
      
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
        apiVersion: '2023-10-16', // Updated to a newer version
      });

      // Calculate price using DB pageCount
      const unitAmount = pageCount * PRICE_PER_PAGE_CENTS;
      const productName = `${projectTitle} (${pageCount} Pages)`; // Use DB title and count
      console.log(`[Product Logic] Details: Name='${productName}', Amount=${unitAmount} cents`);

      // Don't collect shipping for digital products
      const collectShipping = false; // Digital products don't need shipping addresses
      console.log(`[Product Logic] Shipping address collection required: ${collectShipping}`);

      // Create line items using DB values
      const lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName, // Use dynamic name from DB
            description: `Your custom ${pageCount}-page coloring book.`, // Use DB page count
          },
          unit_amount: unitAmount, // Use calculated amount
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
        payment_method_types: ['card'], // Only accept card payments
        payment_method_options: {
          card: {
            setup_future_usage: 'off_session',
            request_three_d_secure: 'automatic'
          }
        },
        payment_intent_data: {
          capture_method: 'automatic',
        },
        billing_address_collection: 'auto', // Only collect minimal billing address
        line_items: lineItems,
        mode: 'payment',
        locale: 'en', // Force English locale to prevent localization issues
        shipping_address_collection: collectShipping
          ? { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'CN'] }
          : undefined,
        client_reference_id: projectId,
        customer_email: userEmail || undefined,
        // Properly configure invoice creation
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Order for ${productName}`,
            metadata: {}
          }
        },
        metadata: { 
          userId,
          projectId,
          pageCount: String(pageCount),
        },
        success_url: `${domain}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${domain}/create?id=${projectId}`,
      });
      console.log(`[Stripe] Checkout session created successfully: ${session.id}`);

      // Return the session ID 
      return { sessionId: session.id };

    } catch (error) {
      console.error('[Stripe Error] Failed to create checkout session:', error);
      // Log more details if it's a Stripe error object
      if (error instanceof Error && 'type' in error) {
          console.error('[Stripe Error Details]', { type: (error as any).type, code: (error as any).code, message: error.message });
      }
      throw new HttpsError('internal', 'Failed to create checkout session');
    }
  }
);

/**
 * Handles Stripe webhook events
 */
export const stripeWebhook = onRequest(
  {
    secrets: [
      STRIPE_SECRET_KEY, 
      STRIPE_WEBHOOK_SECRET,
      // Add AWS secrets needed by sendProjectProcessedEmail
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

              const userId = session.metadata?.userId;
              const projectId = session.metadata?.projectId;
              const pageCount = session.metadata?.pageCount ? parseInt(session.metadata.pageCount, 10) : 0;

              if (!userId || !projectId || pageCount <= 0) {
                  console.error('[Webhook Error] Missing userId, projectId, or valid pageCount in session metadata.', session.metadata);
                  res.status(200).send({ received: true, error: 'Missing required metadata' });
                  return;
              }
              console.log(`[Webhook] Metadata found: userId=${userId}, projectId=${projectId}, pageCount=${pageCount}`);

              // Update project in Firestore
              console.log(`[Firestore] Updating project ${projectId} for user ${userId}...`);
              const db = admin.firestore();
              const projectRef = db.collection('users').doc(userId).collection('projects').doc(projectId);

              try {
                  // Get the project data to access page information
                  const projectSnapshot = await projectRef.get();
                  if (!projectSnapshot.exists) {
                      throw new Error(`Project ${projectId} not found`);
                  }
                  
                  const projectData = projectSnapshot.data();
                  // We'll need pages data later for PDF generation
                  // const pages = projectData?.pages || [];
                  
                  // Update project status and payment info
                  await projectRef.update({
                      status: session.payment_status === 'paid' ? 'processing_pdf' : 'payment_pending',
                      orderNumber: projectId.substring(0, 8).toUpperCase(),
                      orderDate: admin.firestore.FieldValue.serverTimestamp(),
                      estimatedDelivery: admin.firestore.Timestamp.fromDate(
                          new Date(Date.now() + (14 + Math.floor(pageCount / 10)) * 24 * 60 * 60 * 1000)
                      ),
                      paymentId: session.id,
                      paymentStatus: session.payment_status,
                      pageCount: pageCount,
                  });
                  console.log(`[Firestore] Project ${projectId} updated successfully with payment status: ${session.payment_status}`);
                  
                  // Only proceed with PDF generation if payment is successful
                  if (session.payment_status === 'paid') {
                      try {
                          console.log(`[PDF] Starting PDF generation for project ${projectId}`);
                          
                          // Create a PDF filename
                          const pdfFilename = `${projectData?.title || 'Coloring_Book'}_${new Date().getTime()}.pdf`;
                          const pdfStoragePath = `users/${userId}/projects/${projectId}/downloads/${pdfFilename}`;
                          
                          console.log(`[PDF] Created filename: ${pdfFilename}`);
                          console.log(`[PDF] Storage path: ${pdfStoragePath}`);
                          console.log(`[PDF] Bucket name: ${bucketName}`);
                          
                          try {
                              // Actual PDF generation instead of simulation
                              console.log(`[PDF] Starting actual PDF generation`);
                              
                              // Get all page images from the project
                              const projectData = projectSnapshot.data();
                              const pages = projectData?.pages || [];
                              
                              if (pages.length === 0) {
                                  throw new Error('Project has no pages to include in PDF');
                              }
                              
                              console.log(`[PDF] Project has ${pages.length} pages to include in PDF`);
                              
                              // Create temp directory for PDF generation
                              const tempDir = os.tmpdir();
                              const tempPdfPath = path.join(tempDir, pdfFilename);
                              console.log(`[PDF] Using temp path: ${tempPdfPath}`);
                              
                              // Create PDF document
                              const doc = new PDFDocument({
                                  size: 'letter', // Use letter size
                                  margin: 36, // 0.5 inch margins
                                  info: {
                                      Title: projectData?.title || 'Coloring Book',
                                      Author: 'StoryInColor',
                                      Creator: 'StoryInColor PDF Generator'
                                  }
                              });
                              
                              // Create write stream
                              const writeStream = fs.createWriteStream(tempPdfPath);
                              doc.pipe(writeStream);
                              
                              // Add title page
                              doc.fontSize(30)
                                 .font('Helvetica-Bold')
                                 .text(projectData?.title || 'Coloring Book', {
                                     align: 'center'
                                 })
                                 .moveDown(2)
                                 .fontSize(16)
                                 .font('Helvetica')
                                 .text('Created with StoryInColor.com', {
                                     align: 'center'
                                 })
                                 .moveDown(0.5)
                                 .text(`${pages.length} pages to color`, {
                                     align: 'center'
                                 });
                              
                              // Add a note about how to print
                              doc.moveDown(4)
                                 .fontSize(12)
                                 .text('Printing Instructions:', {
                                     align: 'left',
                                     continued: false
                                 })
                                 .moveDown(0.5)
                                 .text('1. Print on 8.5" x 11" paper', {
                                     align: 'left',
                                     continued: false
                                 })
                                 .moveDown(0.5)
                                 .text('2. For best results, use "Fit to page" in your printer settings', {
                                     align: 'left',
                                     continued: false
                                 });
                              
                              doc.addPage();
                              
                              // Process each page and add to PDF
                              console.log(`[PDF] Adding pages to PDF document`);
                              
                              // Function to download and process image
                              async function downloadImage(storagePath: string) {
                                  console.log(`[PDF] Downloading image from ${storagePath}`);
                                  const file = bucket.file(storagePath);
                                  const [buffer] = await file.download();
                                  return buffer;
                              }
                              
                              // Use Promise.all to download all images in parallel
                              const downloadPromises = pages.map(async (page: any, pageIndex: number) => {
                                  try {
                                      // Get selected version (or first if none selected)
                                      const selectedVersionId = page.selectedVersionId;
                                      const versions = page.versions || [];
                                      
                                      if (versions.length === 0) {
                                          console.log(`[PDF] Page ${pageIndex + 1} has no versions, skipping`);
                                          return null;
                                      }
                                      
                                      const version = versions.find((v: any) => v.versionId === selectedVersionId) || versions[0];
                                      
                                      // Use originalStoragePath (unprocessed image) for best quality in PDF
                                      const storagePath = version.originalStoragePath;
                                      
                                      if (!storagePath) {
                                          console.log(`[PDF] No storage path found for page ${pageIndex + 1}, skipping`);
                                          return null;
                                      }
                                      
                                      console.log(`[PDF] Processing page ${pageIndex + 1}, using version ${version.versionId}`);
                                      
                                      // Download the image
                                      const imageBuffer = await downloadImage(storagePath);
                                      return { index: pageIndex, buffer: imageBuffer };
                                  } catch (pageError) {
                                      console.error(`[PDF] Error processing page ${pageIndex + 1}:`, pageError);
                                      return null;
                                  }
                              });
                              
                              // Wait for all downloads to complete
                              const imageResults = await Promise.all(downloadPromises);
                              const validImages = imageResults.filter(result => result !== null);
                              
                              console.log(`[PDF] Downloaded ${validImages.length} valid images out of ${pages.length} pages`);
                              
                              // Add each image to the PDF
                              for (const imageResult of validImages) {
                                  // Add a new page for each image (except the first one which comes after title page)
                                  if (imageResult.index > 0) {
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
                                      
                                      console.log(`[PDF] Added page ${imageResult.index + 1} to PDF`);
                                  } catch (renderError) {
                                      console.error(`[PDF] Error rendering page ${imageResult.index + 1}:`, renderError);
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
                                      }
                                  }
                              });
                              
                              // Clean up temp file
                              fs.unlinkSync(tempPdfPath);
                              console.log(`[PDF] Cleaned up temp file`);
                              
                              console.log(`[PDF] Generated PDF for project ${projectId}`);
                              
                              // Instead of trying to create a signed URL (which requires additional permissions),
                              // we'll create a Firebase Storage download URL that inherits the security rules
                              console.log(`[PDF] Creating Firebase download URL`);
                              
                              // Set metadata to make the file publicly accessible via download URL
                              await bucket.file(pdfStoragePath).setMetadata({
                                  metadata: {
                                      // Add a custom metadata field to track files that should be accessible
                                      'isCompletedPdf': 'true'
                                  }
                              });
                              
                              // Create a download URL - this works with Firebase Storage's security rules
                              const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(pdfStoragePath)}?alt=media`;
                              
                              console.log(`[PDF] Created download URL: ${downloadUrl}`);
                              
                              // Update the project with download information using the regular download URL
                              console.log(`[PDF] Updating project with download info`);
                              await projectRef.update({
                                  status: 'completed',
                                  pdfUrl: downloadUrl,
                                  pdfStoragePath: pdfStoragePath,
                                  pdfGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
                              });
                              
                              console.log(`[Firestore] Project ${projectId} updated with PDF download information`);
                          } catch (innerError) {
                              console.error(`[PDF] Inner error during PDF generation: ${innerError}`);
                              throw innerError; // Re-throw to be caught by outer handler
                          }
                          
                          // Get user information to send email notification
                          console.log(`[PDF] Retrieving user information for email notification`);
                          const userRecord = await admin.auth().getUser(userId);
                          const userEmail = userRecord.email;
                          
                          if (userEmail) {
                              // Send email notification about PDF generation
                              // In a real implementation, you would call your email service here
                              console.log(`[Email] Would send PDF ready notification to ${userEmail}`);
                              
                              // Example of how you might call your existing email notification function
                               try {
                                   console.log(`[Email] Attempting to send notification email`);
                                   await sendProjectProcessedEmail(userEmail, {
                                       projectId,
                                       title: projectData?.title || 'Your Coloring Pages'
                                   });
                                   
                                   // Instead of directly passing the downloadUrl in the email params,
                                   // we'll need to modify the email template function to include a link
                                   // to where the user can download their PDF from the platform
                                   
                                   console.log(`[Email] Sent PDF ready notification to ${userEmail}`);
                               } catch (emailError) {
                                   console.error(`[Email Error] Failed to send PDF notification: ${emailError}`);
                                   // Continue processing - non-critical error
                               }
                          } else {
                              console.log(`[Email] No email address found for user ${userId}`);
                          }
                          
                      } catch (pdfError) {
                          console.error(`[PDF Error] Failed to generate PDF: ${pdfError}`);
                          console.error(`[PDF Error] Stack trace: ${pdfError instanceof Error ? pdfError.stack : 'No stack trace'}`);
                          // Update project to indicate PDF generation failure
                          try {
                              await projectRef.update({
                                  status: 'pdf_failed',
                                  pdfError: String(pdfError)
                              });
                              console.log(`[Firestore] Updated project status to 'pdf_failed'`);
                          } catch (updateError) {
                              console.error(`[Firestore Error] Failed to update project status to 'pdf_failed': ${updateError}`);
                          }
                      }
                  } else {
                      console.log(`[Webhook] Payment not paid, skipping PDF generation. Status: ${session.payment_status}`);
                  }
                  
              } catch (dbError) {
                  console.error(`[Firestore Error] Failed to update project ${projectId}:`, dbError);
                  res.status(500).send('Internal Server Error - Failed to update database.');
                  return;
              }
          } else {
              console.log(`[Webhook] Received unhandled event type: ${event.type}`);
          }

          // Acknowledge receipt of the event to Stripe
          console.log("[Webhook] Sending 200 OK acknowledgement to Stripe.");
          res.status(200).send({ received: true });

      } catch (error) {
          console.error('[Webhook Error] Unexpected error processing webhook:', error);
          res.status(500).send('Internal Server Error - Webhook processing failed.');
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
  console.log('[Email Debug] Welcome email function called with request:', JSON.stringify({
    auth: request.auth ? {
      uid: request.auth.uid,
      email: request.auth.token.email,
      name: request.auth.token.name,
    } : 'No auth',
    data: request.data
  }));
  
  console.log('[Email Debug] Using AWS credentials:', {
    region: AWS_REGION.value(),
    sender: SENDER_EMAIL_ADDRESS.value(),
    keyIdPrefix: AWS_ACCESS_KEY_ID.value().substring(0, 5) + '...' // Log only the prefix for security
  });
  
  // Verify authentication
  if (!request.auth) {
    console.error('[Email] Unauthorized attempt to send welcome email');
    throw new Error('Unauthorized - User must be authenticated');
  }
  
  // Get user details
  // Note: userId is logged but not otherwise used
  const userEmail = request.auth.token.email;
  const displayName = request.auth.token.name || request.data?.displayName;
  
  if (!userEmail) {
    console.error('[Email] User email is required but not found in token');
    throw new Error('User email is required');
  }
  
  console.log(`[Email] Sending welcome email to ${userEmail} (user: ${request.auth.uid})`);
  
  try {
    // Send email notification
    console.log('[Email Debug] About to call sendWelcomeEmail');
    const result = await sendWelcomeEmail(userEmail, displayName);
    console.log(`[Email Debug] Email sending result: ${result}`);
    
    console.log(`[Email] Successfully sent welcome email to ${userEmail}`);
    return { success: true, message: 'Welcome email sent' };
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error);
    // Return the error details to help with debugging
    return { 
      success: false, 
      message: 'Failed to send welcome email', 
      error: error instanceof Error ? error.message : String(error)
    };
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

// Add this function to the end of the file to fetch user data by admin

export const getAuthUserData = onCall({
  secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SENDER_EMAIL_ADDRESS],
}, async (request) => {
  // Verify admin access
  if (!request.auth) {
    console.error('[Admin API] Unauthorized attempt to access user data');
    throw new Error('Unauthorized - User must be authenticated');
  }
  
  // Only allow the admin email to call this function
  if (request.auth.token.email !== 'ipekcioglu@me.com') {
    console.error(`[Admin API] User ${request.auth.token.email} attempted to access admin function`);
    throw new Error('Unauthorized - Admin access only');
  }
  
  const userId = request.data.userId;
  
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  try {
    // Get user from Auth
    const userRecord = await admin.auth().getUser(userId);
    
    // Return user data
    return {
      success: true,
      userData: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        providerData: userRecord.providerData,
        createdAt: userRecord.metadata.creationTime
      }
    };
  } catch (error) {
    console.error('[Admin API] Error fetching user data:', error);
    return { 
      success: false, 
      message: 'Failed to fetch user data', 
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

// Function to list all users - paginated for performance
export const listAllUsers = onCall({
  secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SENDER_EMAIL_ADDRESS],
}, async (request) => {
  // Verify admin access
  if (!request.auth) {
    console.error('[Admin API] Unauthorized attempt to list users');
    throw new Error('Unauthorized - User must be authenticated');
  }
  
  // Only allow the admin email to call this function
  if (request.auth.token.email !== 'ipekcioglu@me.com') {
    console.error(`[Admin API] User ${request.auth.token.email} attempted to access admin function`);
    throw new Error('Unauthorized - Admin access only');
  }
  
  try {
    // Get parameters for pagination
    const pageSize = request.data.pageSize || 1000; // Default limit
    const pageToken = request.data.pageToken;
    
    // List all users
    const listUsersResult = await admin.auth().listUsers(pageSize, pageToken);
    
    // Map to simplified user objects
    const users = listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      createdAt: userRecord.metadata.creationTime
    }));
    
    return {
      success: true,
      users,
      pageToken: listUsersResult.pageToken
    };
  } catch (error) {
    console.error('[Admin API] Error listing users:', error);
    return { 
      success: false, 
      message: 'Failed to list users', 
      error: error instanceof Error ? error.message : String(error)
    };
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
    const watermarkText = "Preview - storyincolor.com";
    // Adjust SVG size and style for a more prominent watermark
    // Try simplifying the SVG drastically for parsing robustness - using inline styles
    const watermarkSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024">
        <text 
          x="50%" 
          y="50%" 
          text-anchor="middle" 
          dominant-baseline="middle" 
          font-family="sans-serif"
          font-size="72"
          font-weight="bold"
          fill="rgba(0,0,0,0.4)"
          transform="rotate(-30 512 512)"
        >${watermarkText}</text>
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
                .jpeg({ quality: 80 }) // Compress with JPEG at 80% quality
                .toBuffer();
                
            // Clear references to free memory - don't modify the constant itself
            (global as any).__temp_originalBuffer = null;
            await cleanupMemory();
            
            console.log(`Resized input image buffer. New size: ${resizedImageBuffer.length} bytes`);
            
            // Determine prompt based on artStyle
            let prompt: string;
            if (artStyle === 'ghibli') {
                prompt = "Transfer to a coloring book image in ghibli style for someone to color";
            } else { // Default to 'classic' or any other style
                prompt = "Transfer to a coloring book image for someone to color";
            }
            console.log(`Using prompt for style '${artStyle}': "${prompt}"`);
            
            // Set up the image input for OpenAI using gpt-image-1
            console.log("Calling OpenAI API with prompt:", prompt);

            // Store resized buffer for possible cleanup
            (global as any).__temp_resizedBuffer = resizedImageBuffer;

            try {
                // Call OpenAI API
                console.log("Using OpenAI client with gpt-image-1 model");
                
                // Direct API call with proper Node.js FormData
                const formData = new FormData();
                formData.append('model', 'gpt-image-1');
                formData.append('prompt', prompt);
                formData.append('n', '1');
                formData.append('size', '1024x1024');
                formData.append('quality', 'medium');

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
                const db = admin.firestore();
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
                
                // Get current versions and check limit
                const currentVersions = currentPages[pageIndex].versions || [];
                if (currentVersions.length >= 3) {
                    throw new HttpsError('failed-precondition', 'Maximum versions (3) already created');
                }
                
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
    const db = admin.firestore();
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
