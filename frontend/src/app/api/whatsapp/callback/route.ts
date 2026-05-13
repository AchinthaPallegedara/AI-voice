import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description") ?? "Authorization denied";

  const message = error
    ? JSON.stringify({ type: "wa-error", error: errorDesc })
    : JSON.stringify({ type: "wa-code", code });

  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting WhatsApp Business...</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0d0d1f; color: #8888aa;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  p { font-size: 0.9rem; }
</style>
</head>
<body>
<p>Connecting your WhatsApp Business account&hellip;</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${message}, window.location.origin);
    }
  } finally {
    window.close();
  }
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
