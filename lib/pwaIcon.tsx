// A simple house glyph, rendered via `next/og`'s ImageResponse for every
// PWA icon size — the favicon, the Apple touch icon, and the Web App
// Manifest icons. Matches the app's existing black/white button styling
// rather than introducing a new brand color. Uses a raw inline <svg>
// polygon/rect (not a CSS border-triangle trick, which Satori — the
// renderer behind ImageResponse — doesn't render correctly) for a crisp
// result at every size. `scale` controls how much of the canvas the glyph
// fills — the maskable manifest icon uses a smaller scale so the glyph
// survives Android's circle/squircle safe-zone cropping.
export function houseIcon(size: number, scale = 0.56) {
  const glyphSize = size * scale;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
      }}
    >
      <svg width={glyphSize} height={glyphSize} viewBox="0 0 100 100">
        <polygon points="50,6 94,46 6,46" fill="#ffffff" />
        <rect x="20" y="46" width="60" height="48" fill="#ffffff" />
      </svg>
    </div>
  );
}
