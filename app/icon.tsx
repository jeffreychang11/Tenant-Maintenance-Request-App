import { ImageResponse } from "next/og";
import { houseIcon } from "@/lib/pwaIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(houseIcon(32), size);
}
