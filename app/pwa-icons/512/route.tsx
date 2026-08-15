import { ImageResponse } from "next/og";
import { houseIcon } from "@/lib/pwaIcon";

export async function GET() {
  return new ImageResponse(houseIcon(512), { width: 512, height: 512 });
}
