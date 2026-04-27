export type ToolCategory = "creative" | "mystical" | "analysis";
export type OutputType = "image" | "image+guide";

export interface Tool {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  heroCopy: string;
  coverImage: string;
  creditCost: number; // advisory; server is canonical
  category: ToolCategory;
  inputHint: string;
  outputType: OutputType;
}

export type JobStatus = "processing" | "complete" | "failed";

export interface Job {
  jobId: string;
  userId: string;
  toolId: string;
  status: JobStatus;
  photoStoragePath: string;
  outputStoragePath?: string;
  outputDownloadUrl?: string;
  creditCost: number;
  createdAt: unknown; // Firestore Timestamp
  completedAt?: unknown;
  error?: string;
  refunded?: boolean;
}

export interface Generation {
  generationId: string;
  jobId: string;
  toolId: string;
  outputStoragePath: string;
  outputDownloadUrl: string;
  createdAt: unknown;
}
