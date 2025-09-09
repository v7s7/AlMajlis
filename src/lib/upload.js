export const CLOUDINARY_CLOUD_NAME = "dx4w3yrgc";
export const CLOUDINARY_UNSIGNED_PRESET = "almajlis_unsigned";

export async function uploadImage(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UNSIGNED_PRESET);
  form.append("folder", "almajlis");

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}
