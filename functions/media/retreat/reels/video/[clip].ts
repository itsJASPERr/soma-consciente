type Context = {
  request: Request;
  next(): Promise<Response>;
};

export async function onRequestGet({ request, next }: Context) {
  const response = await next();
  const range = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/i);
  if (response.status !== 200 || !range || !(range[1] || range[2])) return response;
  if (response.headers.get('Content-Type') !== 'video/mp4' || response.headers.has('Content-Encoding')) return response;

  const ifRange = request.headers.get('If-Range');
  if (ifRange && (ifRange.startsWith('W/') ||
      (ifRange !== response.headers.get('ETag') && ifRange !== response.headers.get('Last-Modified')))) return response;

  // Pages currently returns the full asset even when the client asks for a byte range.
  const bytes = await response.arrayBuffer();
  const length = bytes.byteLength;
  const [, first, last] = range;
  const start = first ? Number(first) : Math.max(0, length - Number(last));
  const end = first && last ? Math.min(Number(last), length - 1) : length - 1;
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  if (start >= length || start > end) {
    headers.set('Content-Range', 'bytes */' + length);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }

  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + length);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
