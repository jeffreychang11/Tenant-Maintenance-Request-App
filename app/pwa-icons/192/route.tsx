import { ImageResponse } from "next/og";
import { houseIcon } from "@/lib/pwaIcon";

export async function GET() {
  return new ImageResponse(houseIcon(192), { width: 192, height: 192 });
}
