import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2, r2Bucket } from "./client";

const DEFAULT_TTL = 60 * 5; // 5분

export async function presignPut(key: string, contentType: string, ttl = DEFAULT_TTL) {
  return getSignedUrl(
    getR2(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: ttl }
  );
}

export async function presignGet(key: string, ttl = DEFAULT_TTL) {
  return getSignedUrl(
    getR2(),
    new GetObjectCommand({ Bucket: r2Bucket(), Key: key }),
    { expiresIn: ttl }
  );
}
