import "./kasaIcon.css";

// Kasa's own icon set (src/assets/kasa-icons). Rendered via a CSS mask so the
// glyph takes `currentColor` and stays crisp at any size, without inlining
// third-party SVG markup. One bundle-time glob keeps every icon addressable by
// name while letting unused ones tree-shake out of the mask map.
const iconUrls = import.meta.glob("../assets/kasa-icons/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(iconUrls)) {
  const name = path.split("/").pop()?.replace(".svg", "");
  if (name) byName[name] = url;
}

export function KasaIcon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const url = byName[name];
  if (!url) return null;
  // Quote the URL: Vite dev asset URLs can carry a query that breaks an
  // unquoted CSS url().
  const mask = `url("${url}")`;
  return (
    <span
      className={`kasa-icon ${className}`.trim()}
      aria-hidden="true"
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
        width: size,
        height: size,
      }}
    />
  );
}
