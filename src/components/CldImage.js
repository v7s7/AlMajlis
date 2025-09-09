import React from "react";
import { Cloudinary } from "@cloudinary/url-gen";
import { AdvancedImage } from "@cloudinary/react";
import { fill } from "@cloudinary/url-gen/actions/resize";
import { autoGravity } from "@cloudinary/url-gen/qualifiers/gravity";

const cld = new Cloudinary({ cloud: { cloudName: "dx4w3yrgc" } }); // <-- your cloud name

export default function CldImage({ publicId, url, w=500, h=300, alt="" }) {
  if (publicId) {
    const img = cld
      .image(publicId)
      .format("auto")
      .quality("auto")
      .resize(fill().width(w).height(h).gravity(autoGravity()));
    return <AdvancedImage cldImg={img} alt={alt} />;
  }
  if (url) {
    // Fallback: normal <img> if we only stored a URL
    return <img src={url} alt={alt} style={{width: w, height: h, objectFit:"cover", borderRadius: 10}} />;
  }
  return null;
}
