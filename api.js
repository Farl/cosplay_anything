const DEFAULT_CONFIG = {
  POLLINATIONS_API_BASE_URL: "https://gen.pollinations.ai",
  POLLINATIONS_MEDIA_BASE_URL: "https://media.pollinations.ai",
  DEFAULT_IMAGE_MODEL: "kontext",
  DEFAULT_IMAGE_SIZE: "1024x1024",
  DEFAULT_IMAGE_QUALITY: "medium",
  STORAGE_KEY: "cosplay-anything-pollinations-key"
};

function getRuntimeConfig() {
  return { ...DEFAULT_CONFIG, ...(globalThis.window?.AI_COSPLAY_CONFIG || {}) };
}

function normalizeBaseUrl(url) {
  return (url || "").replace(/\/$/, "");
}

function buildAuthHeaders(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export function getStoredApiKey() {
  const config = getRuntimeConfig();
  try {
    return globalThis.localStorage?.getItem(config.STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredApiKey(apiKey) {
  const config = getRuntimeConfig();
  try {
    if (!apiKey) {
      globalThis.localStorage?.removeItem(config.STORAGE_KEY);
      return;
    }
    globalThis.localStorage?.setItem(config.STORAGE_KEY, apiKey.trim());
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function formatPollenAmount(value) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(7).replace(/\.?0+$/, "");
}

export function formatImagePriceLabel(pricing = {}) {
  const rate = Number(pricing.completionImageTokens);
  if (!Number.isFinite(rate)) {
    return "Pricing unavailable";
  }
  return `${formatPollenAmount(rate)} pollen / image`;
}

export function parseSize(size = "1024x1024") {
  const match = /^(\d+)x(\d+)$/i.exec(size);
  if (!match) {
    return { width: 1024, height: 1024 };
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function normalizeImageModel(model) {
  return {
    id: model.name,
    description: model.description || "",
    paidOnly: Boolean(model.paid_only),
    priceLabel: formatImagePriceLabel(model.pricing),
    pricing: model.pricing || null
  };
}

async function extractErrorMessage(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.message || data?.error || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export async function fetchImageModels(apiKey = "") {
  const config = getRuntimeConfig();
  const response = await fetch(`${normalizeBaseUrl(config.POLLINATIONS_API_BASE_URL)}/image/models`, {
    headers: buildAuthHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return data
    .filter((model) =>
      model.output_modalities?.includes("image") &&
      model.input_modalities?.includes("image")
    )
    .map(normalizeImageModel);
}

export async function fetchAccountBalance(apiKey) {
  if (!apiKey) return null;

  const config = getRuntimeConfig();
  const response = await fetch(`${normalizeBaseUrl(config.POLLINATIONS_API_BASE_URL)}/account/balance`, {
    headers: buildAuthHeaders(apiKey)
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  return Number(data.balance);
}

export async function uploadReferenceImage(file, apiKey) {
  if (!apiKey) {
    throw new Error("Enter a Pollinations API key to upload the reference image.");
  }

  const config = getRuntimeConfig();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${normalizeBaseUrl(config.POLLINATIONS_MEDIA_BASE_URL)}/upload`, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  if (!data?.url) {
    throw new Error("Upload succeeded but no reference image URL was returned.");
  }

  return data.url;
}

export async function generateCosplayImage({
  apiKey,
  prompt,
  model,
  quality,
  size,
  referenceImageUrl
}) {
  if (!apiKey) {
    throw new Error("Enter a Pollinations API key before generating.");
  }

  const config = getRuntimeConfig();
  const { width, height } = parseSize(size || config.DEFAULT_IMAGE_SIZE);
  const payload = {
    prompt,
    model: model || config.DEFAULT_IMAGE_MODEL,
    quality: quality || config.DEFAULT_IMAGE_QUALITY,
    response_format: "url",
    size: `${width}x${height}`,
    image: referenceImageUrl
  };

  const response = await fetch(`${normalizeBaseUrl(config.POLLINATIONS_API_BASE_URL)}/v1/images/generations`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(apiKey),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Image generation completed but no output URL was returned.");
  }
  return imageUrl;
}
