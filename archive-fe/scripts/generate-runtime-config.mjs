import { writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const mediaProvider = process.env.MEDIA_PROVIDER?.trim() || 'supabase';
const r2ApiUrl = process.env.R2_API_URL?.trim() ?? '';
const r2PublicUrl = process.env.R2_PUBLIC_URL?.trim() ?? '';

if (!['supabase', 'r2'].includes(mediaProvider)) {
  console.error('MEDIA_PROVIDER must be supabase or r2.');
  process.exit(1);
}

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
  process.exit(1);
}

try {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error(
      'SUPABASE_URL must be an https URL without credentials, query parameters, or fragments.',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'SUPABASE_URL is invalid.');
  process.exit(1);
}

const keyLooksLikeServiceRole = /service[_-]?role|secret/i.test(supabasePublishableKey);
let jwtRole = '';
if (supabasePublishableKey.split('.').length === 3) {
  try {
    const payload = JSON.parse(
      Buffer.from(supabasePublishableKey.split('.')[1], 'base64url').toString('utf8'),
    );
    jwtRole = typeof payload.role === 'string' ? payload.role : '';
  } catch {
    jwtRole = '';
  }
}

if (keyLooksLikeServiceRole || jwtRole === 'service_role') {
  console.error('Refusing to write a service-role or secret key to the browser runtime config.');
  process.exit(1);
}

if (mediaProvider === 'r2' && !r2ApiUrl) {
  console.error('R2_API_URL is required when MEDIA_PROVIDER is r2.');
  process.exit(1);
}

for (const [name, value] of [
  ['R2_API_URL', r2ApiUrl],
  ['R2_PUBLIC_URL', r2PublicUrl],
]) {
  if (value) {
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error(
          `${name} must be an https origin without credentials, query parameters, or fragments.`,
        );
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : `${name} is invalid.`);
      process.exit(1);
    }
  }
}

if (mediaProvider === 'r2' && !r2PublicUrl) {
  console.error('R2_PUBLIC_URL is required when MEDIA_PROVIDER is r2.');
  process.exit(1);
}

const output = new URL('../public/runtime-config.js', import.meta.url);
const content = `globalThis.__ARCHIVE_SUPABASE_CONFIG__ = ${JSON.stringify({
  supabaseUrl,
  supabasePublishableKey,
  mediaProvider,
  r2ApiUrl,
  r2PublicUrl,
})};\n`;

await writeFile(output, content, 'utf8');
console.log(`Wrote ${output.pathname}`);
