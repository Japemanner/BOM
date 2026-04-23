import { S3Client, PutObjectCommand, S3ClientConfig } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const config: S3ClientConfig = {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'eu-central-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
  forcePathStyle: true, // Hetzner Object Storage vereist path-style
}

const client = new S3Client(config)

const BUCKET = process.env.S3_BUCKET ?? ''

/**
 * Genereer een presigned PUT URL voor direct upload naar S3.
 * Tenant-isolatie: s3Key bevat tenantId/assistantId prefix.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

/**
 * Bouw de S3 key in het tenant-isolatie format:
 * {tenantId}/{assistantId}/{documentId}-{filename}
 */
export function buildS3Key(tenantId: string, assistantId: string, documentId: string, filename: string): string {
  return `${tenantId}/${assistantId}/${documentId}-${filename}`
}
