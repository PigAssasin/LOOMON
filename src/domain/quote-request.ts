import { z } from "zod";
import type { CustomizationSession } from "@/src/features/customization/customization-storage";

export const quoteSubmissionResultSchema = z.object({
  quoteRequestId: z.uuid(),
  projectId: z.uuid(),
  projectReference: z.string().regex(/^LM-PJ-[A-Z0-9]{8}$/),
  threadId: z.uuid().optional(),
  status: z.literal("submitted"),
  idempotent: z.boolean(),
});

export type QuoteSubmissionResult = z.infer<typeof quoteSubmissionResultSchema>;

export function isApprovedCustomizationBrief(
  session: CustomizationSession | undefined,
) {
  if (!session) return false;
  if (session.intent === "text_only") return Boolean(session.notes.trim());
  return Boolean(session.file);
}

export function sanitizeCustomizationFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "customization.png"
  );
}

export function buildCustomizationAssetPath(input: {
  userId: string;
  requestKey: string;
  fileName: string;
}) {
  const uuid = z.uuid();
  return `${uuid.parse(input.userId)}/${uuid.parse(input.requestKey)}/${sanitizeCustomizationFileName(input.fileName)}`;
}
