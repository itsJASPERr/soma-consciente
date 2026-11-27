export async function readRequestBytes(
  request: Request, maxBytes: number,
): Promise<{ error: 400 | 413 } | { bytes: Uint8Array<ArrayBuffer> }> {
  const reader = request.body?.getReader();
  if (!reader) return { error: 400 };
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        return { error: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { error: 400 };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}
