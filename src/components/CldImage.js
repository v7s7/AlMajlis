// src/components/CldImage.jsx
import React from "react";
import { Cloudinary } from "@cloudinary/url-gen";
import { AdvancedImage, AdvancedVideo } from "@cloudinary/react";
import { fill } from "@cloudinary/url-gen/actions/resize";
import { autoGravity } from "@cloudinary/url-gen/qualifiers/gravity";

const cld = new Cloudinary({ cloud: { cloudName: "dx4w3yrgc" } });

/**
 * Props:
 * - publicId?: string (Cloudinary public_id)
 * - url?: string (direct URL fallback)
 * - mediaType?: "image" | "video" (optional; auto-inferred if omitted)
 * - w?: number
 * - h?: number
 * - alt?: string (for images)
 * - controls?: boolean (videos only; default true)
 * - autoPlay?: boolean (videos only; default false)
 * - loop?: boolean (videos only; default false)
 * - muted?: boolean (videos only; default true if autoPlay)
 * - posterUrl?: string (videos only; optional poster)
 */
export default function CldImage({
  publicId,
  url,
  mediaType,
  w = 500,
  h = 300,
  alt = "",
  controls = true,
  autoPlay = false,
  loop = false,
  muted,
  posterUrl
}) {
  // Infer type from url/publicId if not provided
  const isVideoExt = (s = "") => /\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(s);
  const inferredType =
    mediaType ||
    (isVideoExt(url) ? "video" : isVideoExt(publicId) ? "video" : "image");

  const style = { width: w, height: h, objectFit: "cover", borderRadius: 10 };

  // Cloudinary publicId path
  if (publicId) {
    if (inferredType === "video") {
      const vid = cld
        .video(publicId)
        .format("auto")
        .quality("auto")
        .resize(fill().width(w).height(h).gravity(autoGravity()));
      return (
        <AdvancedVideo
          cldVid={vid}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted ?? autoPlay} // autoPlay videos should be muted
          playsInline
          style={style}
          poster={posterUrl}
        />
      );
    } else {
      const img = cld
        .image(publicId)
        .format("auto")
        .quality("auto")
        .resize(fill().width(w).height(h).gravity(autoGravity()));
      return <AdvancedImage cldImg={img} alt={alt} style={style} />;
    }
  }

  // Plain URL fallback (non-Cloudinary or when only URL is stored)
  if (url) {
    if (inferredType === "video") {
      return (
        <video
          src={url}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted ?? autoPlay}
          playsInline
          style={style}
          poster={posterUrl}
        />
      );
    } else {
      return <img src={url} alt={alt} style={style} />;
    }
  }

  return null;
}
