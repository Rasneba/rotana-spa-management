type StorageBackend = "local" | "s3" | "minio";

interface StorageConfig {
  backend: StorageBackend;
  bucket: string;
  endpoint?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

const config: StorageConfig = {
  backend: (process.env.STORAGE_BACKEND as StorageBackend) || "local",
  bucket: process.env.STORAGE_BUCKET || "dagi-spa",
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  accessKey: process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY,
  baseUrl: process.env.S3_BASE_URL || process.env.MINIO_BASE_URL || "/uploads",
};

function key(tenant: number | string, dir: string, filename: string): string {
  return `${tenant}/${dir}/${filename}`;
}

export async function upload(
  tenant: string | number,
  dir: string,
  filename: string,
  buffer: Buffer,
  mime: string
): Promise<string> {
  const k = key(tenant, dir, filename);

  switch (config.backend) {
    case "s3":
    case "minio": {
      // @ts-ignore - optional dependency
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKey!,
          secretAccessKey: config.secretKey!,
        },
        forcePathStyle: config.backend === "minio",
      });
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: k,
        Body: buffer,
        ContentType: mime,
      }));
      return `${config.baseUrl}/${k}`;
    }

    default: {
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
  }
}

export async function remove(
  tenant: string | number,
  dir: string,
  filename: string
): Promise<void> {
  const k = key(tenant, dir, filename);

  switch (config.backend) {
    case "s3":
    case "minio": {
      // @ts-ignore - optional dependency
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKey!,
          secretAccessKey: config.secretKey!,
        },
        forcePathStyle: config.backend === "minio",
      });
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: k,
      }));
      break;
    }
  }
}

export function isStoredInDb(url: string): boolean {
  return url.startsWith("data:");
}

export function getStorageConfig() {
  return { ...config };
}
