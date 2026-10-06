import type { Context } from 'koa';

const MAX_REQUEST_BYTES = 50 * 1024 * 1024;

export class InvalidFormData extends Error {}

export async function readFormData(ctx: Context): Promise<FormData> {
  if (!ctx.is('multipart/form-data')) throw new InvalidFormData();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of ctx.req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new InvalidFormData();
    chunks.push(Buffer.from(chunk));
  }
  try {
    return await new Request('http://localhost/analyze', {
      method: 'POST',
      headers: { 'content-type': ctx.get('content-type') },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new InvalidFormData();
  }
}

