import { ImageResponse } from "next/og";
import { houseIcon } from "@/lib/pwaIcon";

// Smaller scale (vs. the regular 512 icon) so the glyph stays inside
// Android's maskable safe zone once the OS crops it to a circle/squircle.
export async function GET() {
  return new ImageResponse(houseIcon(512, 0.42), { width: 512, height: 512 });
}
