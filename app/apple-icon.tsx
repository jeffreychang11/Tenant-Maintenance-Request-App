import { ImageResponse } from "next/og";
import { houseIcon } from "@/lib/pwaIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(houseIcon(180), size);
}
