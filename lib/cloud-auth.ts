const metadata = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default";

async function metadataFetch(path: string) {
  const response = await fetch(`${metadata}/${path}`, {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Metadata authentication failed: ${response.status}`);
  return response;
}

export async function cloudAccessToken(): Promise<string> {
  const data = await (await metadataFetch("token")).json() as { access_token: string };
  return data.access_token;
}

export async function ollamaHeaders(): Promise<Record<string, string>> {
  const audience = process.env.OLLAMA_CLOUD_RUN_AUDIENCE;
  if (!audience) return {};
  const token = await (await metadataFetch(`identity?audience=${encodeURIComponent(audience)}`)).text();
  return { Authorization: `Bearer ${token}` };
}
