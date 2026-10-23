import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 15_000;
const ALLOWED_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

type ImageInfo = { mimeType: string; extension: string };

type ImportRequest = {
  url?: unknown;
  displayName?: unknown;
  attribution?: unknown;
  folderId?: unknown;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

function isPrivateIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return (
    (mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false) ||
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isBlockedAddress(value: string): boolean {
  return value.includes(":") ? isPrivateIpv6(value) : isPrivateIpv4(value);
}

async function assertPublicHost(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (
    lower.includes("..") ||
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "metadata.google.internal" ||
    lower === "instance-data.ec2.internal" ||
    lower.endsWith(".internal")
  ) {
    throw new Error("The image host is not allowed.");
  }
  if (lower.includes("%") || lower === "0" || isBlockedAddress(lower)) {
    throw new Error("The image host is not allowed.");
  }
  const records = [
    ...(await Deno.resolveDns(lower, "A").catch(() => [])),
    ...(await Deno.resolveDns(lower, "AAAA").catch(() => [])),
  ];
  if (!records.length || records.some(isBlockedAddress)) {
    throw new Error("The image host is not allowed.");
  }
}

async function validateUrl(value: unknown): Promise<URL> {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 2048
  ) {
    throw new Error("Enter a valid image URL.");
  }
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Only public HTTP(S) image URLs are allowed.");
  }
  await assertPublicHost(url.hostname);
  return url;
}

function imageInfo(bytes: Uint8Array): ImageInfo | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  const text = new TextDecoder();
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(text.decode(bytes.slice(0, 6)))
  ) {
    return { mimeType: "image/gif", extension: "gif" };
  }
  if (
    bytes.length >= 12 &&
    text.decode(bytes.slice(0, 4)) === "RIFF" &&
    text.decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  if (
    bytes.length >= 12 &&
    text.decode(bytes.slice(4, 8)) === "ftyp" &&
    ["avif", "avis"].includes(text.decode(bytes.slice(8, 12)))
  ) {
    return { mimeType: "image/avif", extension: "avif" };
  }
  return undefined;
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) {
    throw new Error("The image is larger than 10 MB.");
  }
  if (!response.body) {
    throw new Error("The image response was empty.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          throw new Error("The image is larger than 10 MB.");
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchImage(
  initialUrl: URL,
): Promise<{ bytes: Uint8Array; finalUrl: URL }> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicHost(url.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "image/*" },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The image request timed out.");
      }
      throw new Error("Could not fetch the image.");
    }
    try {
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) {
          throw new Error("The image has too many redirects.");
        }
        url = await validateUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) {
        throw new Error("The image could not be downloaded.");
      }
      const bytes = await readLimited(response);
      return { bytes, finalUrl: url };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("The image has too many redirects.");
}

function defaultDisplayName(url: URL, mimeType: string): string {
  const name = decodeURIComponent(url.pathname.split("/").pop() ?? "")
    .trim()
    .replace(/\.[a-z0-9]+$/i, "");
  return (
    name.slice(0, 200) || `Imported ${mimeType.replace("image/", "")} image`
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return errorResponse("Authentication required.", 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse("Media import is not configured.", 503);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (
    userError ||
    !user ||
    !(
      user.app_metadata?.role === "admin" ||
      (Array.isArray(user.app_metadata?.roles) &&
        user.app_metadata.roles.includes("admin"))
    )
  ) {
    return errorResponse("Administrator access required.", 403);
  }
  let body: ImportRequest;
  try {
    body = (await request.json()) as ImportRequest;
  } catch {
    return errorResponse("Invalid request body.", 400);
  }
  try {
    const initialUrl = await validateUrl(body.url);
    const { bytes, finalUrl } = await fetchImage(initialUrl);
    const info = imageInfo(bytes);
    if (!info || !ALLOWED_TYPES.has(info.mimeType)) {
      return errorResponse(
        "The downloaded content is not a supported image.",
        415,
      );
    }
    const id = crypto.randomUUID();
    const objectKey = `media/${id}/${crypto.randomUUID()}.${info.extension}`;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: uploadError } = await adminClient.storage
      .from("archive-assets")
      .upload(objectKey, bytes, {
        cacheControl: "3600",
        contentType: info.mimeType,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 200)
        : defaultDisplayName(finalUrl, info.mimeType);
    const folderId =
      typeof body.folderId === "string" &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.folderId)
        ? body.folderId.toLowerCase()
        : null;
    const { data, error: insertError } = await adminClient
      .from("media_assets")
      .insert({
        id,
        display_name: displayName,
        object_key: objectKey,
        provider: "supabase",
        mime_type: info.mimeType,
        byte_size: bytes.byteLength,
        folder_id: folderId,
        original_url: initialUrl.toString(),
        attribution:
          typeof body.attribution === "string"
            ? body.attribution.trim() || null
            : null,
      })
      .select(
        "id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution",
      )
      .single();
    if (insertError) {
      await adminClient.storage.from("archive-assets").remove([objectKey]);
      throw insertError;
    }
    return json(
      {
        asset: data,
        reference: `media:${id}`,
      },
      201,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not import the image.";
    const status =
      message.includes("not allowed") || message.includes("valid image URL")
        ? 400
        : 422;
    return errorResponse(message, status);
  }
});
