import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export interface ObjectStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}

// Both processes access the same private bucket over HTTPS, never a shared disk.
export function createObjectStore(): ObjectStore {
  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const Bucket = process.env.S3_BUCKET!;
  return {
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
    },
    async get(Key) {
      const response = await client.send(new GetObjectCommand({ Bucket, Key }));
      if (!response.Body) throw new Error('Object has no body');
      return response.Body.transformToByteArray();
    },
  };
}

export async function putJson(store: ObjectStore, key: string, value: unknown) {
  await store.put(key, Buffer.from(JSON.stringify(value)), 'application/json');
}

export async function getJson<T>(store: ObjectStore, key: string): Promise<T> {
  return JSON.parse(Buffer.from(await store.get(key)).toString('utf8')) as T;
}
