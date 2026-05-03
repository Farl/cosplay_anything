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

function getImageResultUrl(result) {
  if (result?.url) {
    return result.url;
  }
  if (result?.b64_json) {
    return `data:image/png;base64,${result.b64_json}`;
  }
  return "";
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

export async function generateCosplayImage({
  apiKey,
  prompt,
  model,
  quality,
  size,
  referenceImage
}) {
  if (!apiKey) {
    throw new Error("Enter a Pollinations API key before generating.");
  }
  if (!referenceImage) {
    throw new Error("A reference image is required for cosplay generation.");
  }

  const config = getRuntimeConfig();
  const { width, height } = parseSize(size || config.DEFAULT_IMAGE_SIZE);
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", model || config.DEFAULT_IMAGE_MODEL);
  formData.append("quality", quality || config.DEFAULT_IMAGE_QUALITY);
  formData.append("response_format", "url");
  formData.append("size", `${width}x${height}`);
  formData.append("image", referenceImage);

  const response = await fetch(`${normalizeBaseUrl(config.POLLINATIONS_API_BASE_URL)}/v1/images/edits`, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  const imageUrl = getImageResultUrl(data?.data?.[0]);
  if (!imageUrl) {
    throw new Error("Image generation completed but no usable image payload was returned.");
  }
  return imageUrl;
}
