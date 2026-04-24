import { S3Client, PutObjectCommand, DeleteObjectCommand, S3ClientConfig } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REQUIRED_VARS = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'] as const

function collectMissingVars(): string[] {
  const missing: string[] = []
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) missing.push(key)
  }
  return missing
}

const missing = collectMissingVars()

function buildS3Client(): S3Client {
  if (missing.length > 0) {
    // Client wordt lazy aangemaakt — fout pas bij aanroep zodat NextJS niet crasht bij opstarten zonder env
    // maar we loggen duidelijk bij de eerste S3 interactie
  }

  const config: S3ClientConfig = {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'eu-central-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
    forcePathStyle: true, // Hetzner Object Storage vereist path-style
  }

  return new S3Client(config)
}

const client = buildS3Client()
const BUCKET = process.env.S3_BUCKET ?? ''

/**
 * Runtime-validatie van S3 configuratie.
 * Gooit error met duidelijke melding als env vars ontbreken.
 */
export function validateS3Config(): void {
  if (missing.length > 0) {
    throw new Error(
      `S3 niet geconfigureerd. Ontbrekende environment variables: ${missing.join(', ')}. ` +
      `Voeg deze toe aan .env.local en herstart NextJS.`
    )
  }
}

/**
 * Genereer een presigned PUT URL voor direct upload naar S3.
 * Tenant-isolatie: s3Key bevat tenantId/assistantId prefix.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  validateS3Config()
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

/**
 * Verwijder een object uit S3.
 * Best effort: faalt stil als config niet aanwezig is.
 */
export async function deleteS3Object(key: string): Promise<void> {
  try {
    validateS3Config()
    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    await client.send(command)
  } catch {
    // Stil falen: cleanup is best-effort. File blijft mogelijk staan als orphan.
  }
}

/**
 * Bouw de S3 key in het tenant-isolatie format:
 * {tenantId}/{assistantId}/{documentId}-{filename}
 */
export function buildS3Key(tenantId: string, assistantId: string, documentId: string, filename: string): string {
  return `${tenantId}/${assistantId}/${documentId}-${filename}`
}
