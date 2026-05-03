import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchAccountBalance,
  fetchImageModels,
  formatImagePriceLabel,
  formatPollenAmount,
  generateCosplayImage,
  parseSize
} from "../api.js";

test("fetchImageModels only returns image-edit capable models with pricing labels", async () => {
  global.window = {
    AI_COSPLAY_CONFIG: {
      POLLINATIONS_API_BASE_URL: "https://gen.pollinations.ai"
    }
  };

  global.fetch = async (url, options = {}) => {
    assert.equal(url, "https://gen.pollinations.ai/image/models");
    assert.equal(options.headers.Authorization, "Bearer pk_demo");

    return new Response(JSON.stringify([
      {
        name: "kontext",
        description: "Edit images with a reference",
        pricing: { completionImageTokens: "0.04" },
        input_modalities: ["text", "image"],
        output_modalities: ["image"]
      },
      {
        name: "flux",
        description: "Text only",
        pricing: { completionImageTokens: "0.001" },
        input_modalities: ["text"],
        output_modalities: ["image"]
      }
    ]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const models = await fetchImageModels("pk_demo");
  assert.deepEqual(models, [
    {
      id: "kontext",
      description: "Edit images with a reference",
      paidOnly: false,
      priceLabel: "0.04 pollen / image",
      pricing: { completionImageTokens: "0.04" }
    }
  ]);
});

test("fetchAccountBalance returns null for unauthorized keys", async () => {
  global.window = {
    AI_COSPLAY_CONFIG: {
      POLLINATIONS_API_BASE_URL: "https://gen.pollinations.ai"
    }
  };

  global.fetch = async () => new Response("{}", { status: 403 });

  assert.equal(await fetchAccountBalance("pk_demo"), null);
});

test("generateCosplayImage sends multipart form data to the image edits endpoint", async () => {
  global.window = {
    AI_COSPLAY_CONFIG: {
      POLLINATIONS_API_BASE_URL: "https://gen.pollinations.ai"
    }
  };

  global.fetch = async (url, options = {}) => {
    assert.equal(url, "https://gen.pollinations.ai/v1/images/edits");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer pk_demo");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("prompt"), "cosplay prompt");
    assert.equal(options.body.get("model"), "kontext");
    assert.equal(options.body.get("quality"), "medium");
    assert.equal(options.body.get("size"), "1024x1024");
    assert.equal(options.body.get("response_format"), "url");
    assert.ok(options.body.get("image") instanceof File);

    return new Response(JSON.stringify({
      created: Date.now(),
      data: [{ url: "https://image.pollinations.ai/output.png" }]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const file = new File(["demo"], "demo.png", { type: "image/png" });
  assert.equal(
    await generateCosplayImage({
      apiKey: "pk_demo",
      prompt: "cosplay prompt",
      model: "kontext",
      quality: "medium",
      size: "1024x1024",
      referenceImage: file
    }),
    "https://image.pollinations.ai/output.png"
  );
});

test("format helpers keep pricing readable", () => {
  assert.equal(formatPollenAmount(1.234567), "1.234567");
  assert.equal(formatImagePriceLabel({ completionImageTokens: "0.001" }), "0.001 pollen / image");
  assert.deepEqual(parseSize("1536x1024"), { width: 1536, height: 1024 });
});
