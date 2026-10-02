/** The app is the default entry; the optional tour requires an explicit URL. */
export function isPresentationEntry(search: string) {
  const params = new URLSearchParams(search);
  return (
    !params.has("app") &&
    !params.has("device") &&
    !params.has("simulator") &&
    params.get("present") === "1"
  );
}
