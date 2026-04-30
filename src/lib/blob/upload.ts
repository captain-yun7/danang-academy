"use server";

import { put } from "@vercel/blob";

export async function uploadAudioBlob(
  pathname: string,
  data: Blob | ArrayBuffer | Buffer,
  contentType = "audio/webm"
) {
  const blob = await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return blob.url;
}
