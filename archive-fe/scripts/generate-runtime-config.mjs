import { writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.');
  process.exit(1);
}

try {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('SUPABASE_URL must be an https URL without credentials, query parameters, or fragments.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'SUPABASE_URL is invalid.');
  process.exit(1);
}

const keyLooksLikeServiceRole = /service[_-]?role|secret/i.test(supabasePublishableKey);
let jwtRole = '';
if (supabasePublishableKey.split('.').length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(supabasePublishableKey.split('.')[1], 'base64url').toString('utf8'));
    jwtRole = typeof payload.role === 'string' ? payload.role : '';
  } catch {
    jwtRole = '';
  }
}

if (keyLooksLikeServiceRole || jwtRole === 'service_role') {
  console.error('Refusing to write a service-role or secret key to the browser runtime config.');
  process.exit(1);
}

const output = new URL('../public/runtime-config.js', import.meta.url);
const content = `globalThis.__ARCHIVE_SUPABASE_CONFIG__ = ${JSON.stringify({
  supabaseUrl,
  supabasePublishableKey,
})};\n`;

await writeFile(output, content, 'utf8');
console.log(`Wrote ${output.pathname}`);
