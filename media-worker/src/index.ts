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
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Env = {
  MEDIA_BUCKET: R2Bucket;
  APP_ORIGINS: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  R2_PUBLIC_URL: string;
};

type MediaAssetRow = {
  id: string;
  display_name: string;
  object_key: string;
  provider: "supabase" | "r2";
  mime_type: string;
  byte_size: number;
  folder_id: string | null;
  original_url: string | null;
  attribution: string | null;
};

type ImageInfo = { mimeType: string; extension: string };

function origins(env: Env): Set<string> {
  return new Set(
    env.APP_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "DELETE, OPTIONS, POST",
    vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin && origins(env).has(origin))
    headers.set("access-control-allow-origin", origin);
  return headers;
}

function json(
  request: Request,
  env: Env,
  body: unknown,
  status = 200,
): Response {
  const headers = corsHeaders(request, env);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  request: Request,
  env: Env,
  message: string,
  status: number,
): Response {
  return json(request, env, { error: message }, status);
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(message)),
      FETCH_TIMEOUT_MS,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function isPrivateIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
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
    lower.endsWith(".internal") ||
    lower.includes("%") ||
    lower === "0" ||
    isBlockedAddress(lower)
  ) {
    throw new Error("The image host is not allowed.");
  }
  const records = await Promise.all(
    ["A", "AAAA"].map(async (type) => {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(lower)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      const body = (await response.json().catch(() => undefined)) as
        { Answer?: { type: number; data: string }[] } | undefined;
      return body?.Answer ?? [];
    }),
  );
  const addresses = records
    .flat()
    .filter((record) => record.type === 1 || record.type === 28)
    .map((record) => record.data);
  if (!addresses.length || addresses.some(isBlockedAddress)) {
    throw new Error("The image host is not allowed.");
  }
}

async function validateUrl(value: unknown): Promise<URL> {
  if (typeof value !== "string" || !value.trim() || value.length > 2048)
    throw new Error("Enter a valid image URL.");
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
  )
    return { mimeType: "image/png", extension: "png" };
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return { mimeType: "image/jpeg", extension: "jpg" };
  const text = new TextDecoder();
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(text.decode(bytes.slice(0, 6)))
  )
    return { mimeType: "image/gif", extension: "gif" };
  if (
    bytes.length >= 12 &&
    text.decode(bytes.slice(0, 4)) === "RIFF" &&
    text.decode(bytes.slice(8, 12)) === "WEBP"
  )
    return { mimeType: "image/webp", extension: "webp" };
  if (
    bytes.length >= 12 &&
    text.decode(bytes.slice(4, 8)) === "ftyp" &&
    ["avif", "avis"].includes(text.decode(bytes.slice(8, 12)))
  )
    return { mimeType: "image/avif", extension: "avif" };
  return undefined;
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES || !response.body)
    throw new Error("The image is larger than 10 MB or empty.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES)
          throw new Error("The image is larger than 10 MB.");
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
      clearTimeout(timeout);
      if (error instanceof DOMException && error.name === "AbortError")
        throw new Error("The image request timed out.");
      throw new Error("Could not fetch the image.");
    }
    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timeout);
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS)
        throw new Error("The image has too many redirects.");
      url = await validateUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error("The image could not be downloaded.");
    }
    try {
      return { bytes: await readLimited(response), finalUrl: url };
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

function bearer(request: Request): string {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer "))
    throw new Error("Authentication required.");
  return value;
}

type AuthenticatedUser = {
  app_metadata?: { role?: unknown; roles?: unknown };
};

async function authenticatedUser(
  request: Request,
  env: Env,
): Promise<AuthenticatedUser> {
  const authorization = bearer(request);
  const response = await withTimeout(
    fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization },
    }),
    "Authentication request timed out.",
  );
  if (!response.ok) throw new Error("Authentication required.");
  return (await response.json()) as AuthenticatedUser;
}

async function assertAuthenticated(request: Request, env: Env): Promise<void> {
  await authenticatedUser(request, env);
}

async function assertAdmin(request: Request, env: Env): Promise<void> {
  const user = await authenticatedUser(request, env);
  const roles = Array.isArray(user.app_metadata?.roles)
    ? user.app_metadata.roles
    : [];
  if (user.app_metadata?.role !== "admin" && !roles.includes("admin"))
    throw new Error("Administrator access required.");
}

async function supabaseRequest<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`,
    {
      ...init,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        ...init.headers,
      },
    },
  );
  if (!response.ok)
    throw new Error(`Supabase request failed with ${response.status}.`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function assetResponse(asset: MediaAssetRow): {
  asset: MediaAssetRow;
  reference: string;
} {
  return { asset, reference: `media:${asset.id}` };
}

async function createAsset(
  request: Request,
  env: Env,
  bytes: Uint8Array,
  info: ImageInfo,
  fields: {
    displayName?: unknown;
    attribution?: unknown;
    folderId?: unknown;
    originalUrl?: string;
  },
): Promise<MediaAssetRow> {
  const id = crypto.randomUUID();
  const objectKey = `media/${id}/${crypto.randomUUID()}.${info.extension}`;
  await env.MEDIA_BUCKET.put(objectKey, bytes, {
    httpMetadata: {
      contentType: info.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  try {
    const rows = await supabaseRequest<MediaAssetRow[]>(env, "media_assets", {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        id,
        display_name:
          typeof fields.displayName === "string" && fields.displayName.trim()
            ? fields.displayName.trim().slice(0, 200)
            : `Imported ${info.mimeType.replace("image/", "")} image`,
        object_key: objectKey,
        provider: "r2",
        mime_type: info.mimeType,
        byte_size: bytes.byteLength,
        folder_id:
          typeof fields.folderId === "string" &&
          UUID_PATTERN.test(fields.folderId)
            ? fields.folderId.toLowerCase()
            : null,
        original_url: fields.originalUrl ?? null,
        attribution:
          typeof fields.attribution === "string"
            ? fields.attribution.trim() || null
            : null,
      }),
    });
    return rows[0];
  } catch (error) {
    await env.MEDIA_BUCKET.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

async function formFile(
  request: Request,
): Promise<{ file: File; fields: Record<string, string> }> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    throw new Error("Choose a non-empty image file.");
  if (file.size > MAX_BYTES)
    throw new Error("Images must be 10 MB or smaller.");
  const info = imageInfo(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  if (!info || !ALLOWED_TYPES.has(info.mimeType))
    throw new Error("The selected file is not a valid image.");
  return {
    file,
    fields: Object.fromEntries(
      ["displayName", "attribution", "folderId", "originalUrl"].map((key) => [
        key,
        String(form.get(key) ?? ""),
      ]),
    ),
  };
}

async function handleUpload(
  request: Request,
  env: Env,
): Promise<{ asset: MediaAssetRow; reference: string }> {
  const { file, fields } = await formFile(request);
  const info = imageInfo(
    new Uint8Array(await file.slice(0, 12).arrayBuffer()),
  ) as ImageInfo;
  return assetResponse(
    await createAsset(
      request,
      env,
      new Uint8Array(await file.arrayBuffer()),
      info,
      fields,
    ),
  );
}

async function handleImport(
  request: Request,
  env: Env,
): Promise<{ asset: MediaAssetRow; reference: string }> {
  const body = (await request.json()) as {
    url?: unknown;
    displayName?: unknown;
    attribution?: unknown;
    folderId?: unknown;
  };
  const initialUrl = await validateUrl(body.url);
  const { bytes, finalUrl } = await fetchImage(initialUrl);
  const info = imageInfo(bytes);
  if (!info || !ALLOWED_TYPES.has(info.mimeType))
    throw new Error("The downloaded content is not a supported image.");
  return assetResponse(
    await createAsset(request, env, bytes, info, {
      displayName:
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName
          : defaultDisplayName(finalUrl, info.mimeType),
      attribution: body.attribution,
      folderId: body.folderId,
      originalUrl: initialUrl.toString(),
    }),
  );
}

async function getAsset(env: Env, id: string): Promise<MediaAssetRow> {
  if (!UUID_PATTERN.test(id)) throw new Error("Invalid media asset ID.");
  const rows = await supabaseRequest<MediaAssetRow[]>(
    env,
    `media_assets?id=eq.${id.toLowerCase()}&select=id,display_name,object_key,provider,mime_type,byte_size,folder_id,original_url,attribution`,
  );
  if (!rows[0]) throw new Error("Media asset not found.");
  return rows[0];
}

async function handleReplace(
  request: Request,
  env: Env,
  id: string,
): Promise<{ asset: MediaAssetRow; reference: string }> {
  const current = await getAsset(env, id);
  if (current.provider !== "r2")
    throw new Error("Only R2 media assets can be replaced through the R2 API.");
  const { file } = await formFile(request);
  const info = imageInfo(
    new Uint8Array(await file.slice(0, 12).arrayBuffer()),
  ) as ImageInfo;
  const objectKey = `media/${current.id}/${crypto.randomUUID()}.${info.extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await env.MEDIA_BUCKET.put(objectKey, bytes, {
    httpMetadata: {
      contentType: info.mimeType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  try {
    const rows = await supabaseRequest<MediaAssetRow[]>(
      env,
      `media_assets?id=eq.${current.id}`,
      {
        method: "PATCH",
        headers: { prefer: "return=representation" },
        body: JSON.stringify({
          object_key: objectKey,
          provider: "r2",
          mime_type: info.mimeType,
          byte_size: bytes.byteLength,
        }),
      },
    );
    await env.MEDIA_BUCKET.delete(current.object_key).catch(() => undefined);
    return assetResponse(rows[0]);
  } catch (error) {
    await env.MEDIA_BUCKET.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

async function handleDelete(
  request: Request,
  env: Env,
  id: string,
): Promise<void> {
  const current = await getAsset(env, id);
  if (current.provider !== "r2")
    throw new Error("Only R2 media assets can be deleted through the R2 API.");
  await supabaseRequest(env, `media_assets?id=eq.${current.id}`, {
    method: "DELETE",
  });
  await env.MEDIA_BUCKET.delete(current.object_key);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    if (!origins(env).has(request.headers.get("origin") ?? ""))
      return errorResponse(request, env, "Origin not allowed.", 403);
    try {
      const url = new URL(request.url);
      const match = url.pathname.match(
        /^\/media(?:\/(upload|import|replace|delete))?(?:\/([0-9a-f-]+))?$/,
      );
      if (!match || !match[1])
        return errorResponse(request, env, "Not found.", 404);
      if (match[1] === "upload" || match[1] === "import")
        await assertAuthenticated(request, env);
      else await assertAdmin(request, env);
      if (request.method === "POST" && match[1] === "upload")
        return json(request, env, await handleUpload(request, env), 201);
      if (request.method === "POST" && match[1] === "import")
        return json(request, env, await handleImport(request, env), 201);
      if (request.method === "POST" && match[1] === "replace" && match[2])
        return json(request, env, await handleReplace(request, env, match[2]));
      if (request.method === "DELETE" && match[1] === "delete" && match[2]) {
        await handleDelete(request, env, match[2]);
        return json(request, env, {});
      }
      return errorResponse(request, env, "Not found.", 404);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Media operation failed.";
      const status = message.includes("Authentication required")
        ? 401
        : message.includes("Administrator") || message.includes("Origin")
          ? 403
          : message.includes("not found")
            ? 404
            : 422;
      return errorResponse(request, env, message, status);
    }
  },
};
