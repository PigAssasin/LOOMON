import "server-only";

export const SELLER_COMMAND_MAX_BODY_BYTES = 16_384;

export class JsonRequestError extends Error {
  constructor(
    public readonly code:
      | "UNSUPPORTED_MEDIA_TYPE"
      | "PAYLOAD_TOO_LARGE"
      | "INVALID_JSON",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JsonRequestError";
  }
}

export async function readSellerCommandJson(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new JsonRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Use application/json for seller commands.",
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > SELLER_COMMAND_MAX_BODY_BYTES
  ) {
    throw new JsonRequestError(
      "PAYLOAD_TOO_LARGE",
      "The seller command is too large.",
      413,
    );
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > SELLER_COMMAND_MAX_BODY_BYTES) {
    throw new JsonRequestError(
      "PAYLOAD_TOO_LARGE",
      "The seller command is too large.",
      413,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new JsonRequestError(
      "INVALID_JSON",
      "The request body is not valid JSON.",
      400,
    );
  }
}

