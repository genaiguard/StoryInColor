/**
 * createShareLink — turns a private completed job into a public, branded
 * share doc.
 *
 * Why this exists: the result page is gated by Firestore rules
 * (users/{uid}/jobs/{jobId} is owner-read only), so the original "Share"
 * button leaked a URL recipients couldn't open. This callable validates
 * the requester owns a complete job, then creates a public
 * sharedReadings/{shareId} doc carrying just the toolId, the tokenized
 * outputDownloadUrl, and audit metadata. The /share?id=… route reads it
 * with no auth.
 *
 * Security:
 *   - request.auth required
 *   - jobId must point at a job owned by the requester
 *   - job must be status === 'complete' with an outputDownloadUrl
 *   - sharedReadings rules forbid client writes (admin SDK bypasses)
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

// Reuse the already-initialized default app from index.ts. If this module
// is loaded standalone (tests, scripts), fall back to a no-op init.
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

interface CreateShareLinkInput {
    jobId: string;
}

interface CreateShareLinkResult {
    shareId: string;
}

export const createShareLink = onCall<CreateShareLinkInput>(
    { labels: { 'deployment-callable': 'true' } },
    async (request): Promise<CreateShareLinkResult> => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Sign in to create a share link.');
        }
        const userId = request.auth.uid;
        const jobId = request.data?.jobId;
        if (!jobId || typeof jobId !== 'string') {
            throw new HttpsError('invalid-argument', 'jobId is required.');
        }

        // Validate ownership + completeness server-side. The client cannot
        // be trusted with the imageUrl directly because rules let only the
        // owner read jobs, but a malicious caller could still try to share
        // someone else's jobId guessed from a UUID.
        const jobRef = db.collection('users').doc(userId).collection('jobs').doc(jobId);
        const jobSnap = await jobRef.get();
        if (!jobSnap.exists) {
            throw new HttpsError('not-found', 'Job not found.');
        }
        const job = jobSnap.data() as {
            status?: string;
            outputDownloadUrl?: string;
            toolId?: string;
        };
        if (job.status !== 'complete') {
            throw new HttpsError('failed-precondition', 'Job is not complete yet.');
        }
        if (!job.outputDownloadUrl) {
            throw new HttpsError('failed-precondition', 'Job has no output URL.');
        }
        if (!job.toolId) {
            throw new HttpsError('failed-precondition', 'Job has no toolId.');
        }

        // Reuse an existing share doc if the user already shared this job —
        // keeps URLs stable when the same user clicks Share twice.
        const existing = await db
            .collection('sharedReadings')
            .where('jobId', '==', jobId)
            .where('createdBy', '==', userId)
            .limit(1)
            .get();
        if (!existing.empty) {
            return { shareId: existing.docs[0].id };
        }

        // 16 hex chars (8 random bytes) — 2^64 keyspace, easy to copy/paste,
        // hard to enumerate. Collision risk is negligible at our scale.
        const shareId = crypto.randomBytes(8).toString('hex');

        await db.collection('sharedReadings').doc(shareId).set({
            shareId,
            toolId: job.toolId,
            imageUrl: job.outputDownloadUrl,
            createdBy: userId,
            jobId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { shareId };
    },
);
