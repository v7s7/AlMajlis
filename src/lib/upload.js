// src/lib/upload.js

export const CLOUDINARY_CLOUD_NAME = "dx4w3yrgc";
export const CLOUDINARY_UNSIGNED_PRESET = "almajlis_unsigned";

/**
 * Uploads an image or video to Cloudinary (unsigned).
 * Accepts a File/Blob OR a remote URL string.
 * Returns { url, publicId, resourceType, width, height, bytes, format }.
 */
export async function uploadAsset(file, opts = {}) {
  if (!file) throw new Error("No file provided");

  const {
    folder = "almajlis",
    // optionally force: "image" | "video"
    resourceType: forcedType,
  } = opts;

  const isVideo = forcedType
    ? forcedType === "video"
    : typeof file !== "string" && (file.type || "").startsWith("video/");

  // Use the auto endpoint so Cloudinary infers type correctly
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

  const form = new FormData();
  form.append("upload_preset", CLOUDINARY_UNSIGNED_PRESET);
  if (folder) form.append("folder", folder);

  // Cloudinary accepts either a Blob/File or a remote URL in the "file" field
  form.append("file", file);

  const res = await fetch(endpoint, { method: "POST", body: form });

  // Try to parse JSON either way to surface clear errors
  let json;
  try {
    json = await res.json();
  } catch {
    const text = await res.text();
    throw new Error(`Upload failed (non-JSON): ${text?.slice(0, 300)}`);
  }

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      "Upload failed";
    throw new Error(msg);
  }

  return {
    url: json.secure_url,
    publicId: json.public_id,
    resourceType: json.resource_type, // "image" | "video" | etc.
    width: json.width,
    height: json.height,
    bytes: json.bytes,
    format: json.format,
    isVideo, // convenience flag based on input MIME (may differ if remote URL)
  };
}

/**
 * Backward compatibility: your code imports `uploadImage`.
 * This now handles BOTH images and videos transparently.
 */
export const uploadImage = uploadAsset;

/** Optional explicit alias if you want to call it directly elsewhere */
export const uploadVideo = (file, opts = {}) => uploadAsset(file, { ...opts, resourceType: "video" });
