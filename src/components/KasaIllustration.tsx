// Full-colour Kasa illustrations (src/assets/kasa-illustrations) for empty
// states and feature moments. These are multi-tone artworks, so they render as
// an <img> rather than a currentColor mask. Decorative by default.
const illustrationUrls = import.meta.glob(
  "../assets/kasa-illustrations/*.svg",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(illustrationUrls)) {
  const name = path.split("/").pop()?.replace(".svg", "");
  if (name) byName[name] = url;
}

export function KasaIllustration({
  name,
  width = 240,
  className = "",
  alt = "",
}: {
  name: string;
  width?: number | string;
  className?: string;
  alt?: string;
}) {
  const url = byName[name];
  if (!url) return null;
  return (
    <img
      src={url}
      className={`kasa-illustration ${className}`.trim()}
      style={{ width, maxWidth: "100%", height: "auto" }}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      loading="lazy"
    />
  );
}
