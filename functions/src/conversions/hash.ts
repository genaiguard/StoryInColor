import { createHash } from "crypto";

/** SHA-256 hex of a string. Meta CAPI requires every PII user_data field
 *  (email, phone, name, dob, gender, city, state, zip, country, external_id
 *  when it could be PII) to be normalised then hashed. We use this for
 *  email and UID. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Meta's email normalisation: lower-case + trim. Returns hashed hex. */
export function hashEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return undefined;
  return sha256Hex(normalised);
}

/** UIDs are non-PII opaque tokens but Meta's match-quality scorer prefers
 *  hashed external_ids regardless. Lower-case for consistency. */
export function hashUid(uid: string | null | undefined): string | undefined {
  if (!uid) return undefined;
  return sha256Hex(uid.toLowerCase());
}
