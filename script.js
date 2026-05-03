import {
  fetchAccountBalance,
  fetchImageModels,
  formatPollenAmount,
  generateCosplayImage,
  getStoredApiKey,
  setStoredApiKey,
  uploadReferenceImage
} from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const imageDropper = document.getElementById("image-dropper");
  const fileInput = document.getElementById("file-input");
  const imagePreview = document.getElementById("image-preview");
  const dropperLabel = document.getElementById("dropper-label");
  const pasteBtn = document.getElementById("paste-btn");
  const generateBtn = document.getElementById("generate-btn");
  const outputImage = document.getElementById("output-image");
  const loader = document.getElementById("loader");
  const outputPlaceholder = document.getElementById("output-placeholder");
  const outputMeta = document.getElementById("output-meta");
  const downloadLink = document.getElementById("download-link");
  const cosplayerGenderSelect = document.getElementById("cosplayer-gender");
  const cosplayLocationSelect = document.getElementById("cosplay-location");
  const cosplayBudgetSelect = document.getElementById("cosplay-budget");
  const imageModelSelect = document.getElementById("image-model-select");
  const imageQualitySelect = document.getElementById("image-quality");
  const imageSizeSelect = document.getElementById("image-size");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const clearKeyBtn = document.getElementById("clear-key-btn");
  const apiKeyNote = document.getElementById("api-key-note");
  const apiKeyStatusValue = document.getElementById("api-key-status-value");
  const apiKeyStatusNote = document.getElementById("api-key-status-note");
  const balanceValue = document.getElementById("balance-value");
  const balanceNote = document.getElementById("balance-note");
  const modelPriceValue = document.getElementById("model-price-value");
  const modelPriceNote = document.getElementById("model-price-note");
  const fullscreenView = document.getElementById("fullscreen-view");
  const fullscreenImage = document.getElementById("fullscreen-image");
  const closeFullscreen = document.getElementById("close-fullscreen");
  const halloweenToggle = document.getElementById("halloween-toggle");

  let referenceFile = null;
  let previewUrl = "";
  let generatedImageUrl = "";
  let imageModels = [];

  const normalLocations = Array.from(cosplayLocationSelect.options).map((option) => ({
    value: option.value,
    text: option.text
  }));
  const halloweenLocations = [
    { value: "at a haunted Victorian mansion with fog and jack-o'-lanterns", text: "Haunted Mansion" },
    { value: "in a moonlit graveyard with drifting mist and ancient tombstones", text: "Moonlit Graveyard" },
    { value: "on a spooky forest trail with glowing pumpkins and fireflies", text: "Spooky Forest" },
    { value: "at a Halloween street festival with costumes and lanterns", text: "Halloween Street Festival" },
    { value: "in a dimly lit gothic cathedral with candles and stained glass", text: "Gothic Cathedral" },
    { value: "outside a witch's cottage with cauldron smoke and black cats", text: "Witch's Cottage" }
  ];

  const realismBoost = [
    "strictly photorealistic real-person cosplay",
    "on-location photography",
    "natural skin texture",
    "real hair strands",
    "fabric stitching and wrinkles",
    "practical costume materials",
    "camera-realistic depth of field",
    "soft realistic shadows",
    "no illustration",
    "no painting",
    "no CGI",
    "no cartoon"
  ].join(", ");

  const halloweenRealism = [
    "grounded Halloween ambience",
    "practical pumpkins and candles",
    "subtle atmospheric fog",
    "fallen leaves",
    "moody cinematic lighting"
  ].join(", ");

  function getApiKey() {
    return apiKeyInput.value.trim();
  }

  function getSelectedModel() {
    return imageModels.find((model) => model.id === imageModelSelect.value) || null;
  }

  function updateGenerateState() {
    generateBtn.disabled = !(referenceFile && getApiKey() && imageModelSelect.value);
  }

  function updateModelSummary() {
    const model = getSelectedModel();
    if (!model) {
      modelPriceValue.textContent = "Unavailable";
      modelPriceNote.textContent = "No compatible image-edit model is currently selected.";
      updateGenerateState();
      return;
    }

    modelPriceValue.textContent = model.priceLabel;
    modelPriceNote.textContent = model.description || "Official Pollinations pricing for the selected model.";
    updateGenerateState();
  }

  function setKeyStatus(note, isConnected) {
    apiKeyStatusValue.textContent = isConnected ? "Connected" : "Not connected";
    apiKeyStatusNote.textContent = note;
  }

  function updateBalanceSummaryLoading() {
    balanceValue.textContent = "Loading…";
    balanceNote.textContent = "Checking your Pollinations balance.";
  }

  function resetOutput(message = "Your generated cosplay image will appear here.") {
    generatedImageUrl = "";
    outputImage.src = "";
    outputImage.classList.add("hidden");
    outputPlaceholder.textContent = message;
    outputPlaceholder.classList.remove("hidden");
    outputMeta.textContent = "Your generated cosplay image will appear here.";
    downloadLink.classList.add("hidden");
    downloadLink.href = "#";
  }

  function setLoading(isLoading, message = "Working…") {
    if (isLoading) {
      loader.classList.remove("hidden");
      outputPlaceholder.textContent = message;
      outputPlaceholder.classList.remove("hidden");
      outputImage.classList.add("hidden");
      downloadLink.classList.add("hidden");
      generateBtn.disabled = true;
      saveKeyBtn.disabled = true;
      clearKeyBtn.disabled = true;
    } else {
      loader.classList.add("hidden");
      saveKeyBtn.disabled = false;
      clearKeyBtn.disabled = false;
      updateGenerateState();
    }
  }

  function updatePreview(file) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(file);
    imagePreview.src = previewUrl;
    imagePreview.classList.remove("hidden");
    dropperLabel.classList.add("hidden");
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    referenceFile = file;
    updatePreview(file);
    resetOutput("Reference image ready. Generate when your key and model are set.");
    updateGenerateState();
  }

  function refreshLocations() {
    document.body.classList.toggle("halloween", halloweenToggle.checked);
    const locations = halloweenToggle.checked ? halloweenLocations : normalLocations;
    cosplayLocationSelect.innerHTML = "";
    locations.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.text;
      cosplayLocationSelect.appendChild(option);
    });
  }

  function buildCosplayPrompt() {
    const gender = cosplayerGenderSelect.value;
    const location = cosplayLocationSelect.value;
    const budget = cosplayBudgetSelect.value;
    const isHalloween = halloweenToggle.checked;

    const environmentDetails = isHalloween
      ? `${location}, tangible real-world textures, weathered surfaces, practical props, warm candle glow`
      : `${location}, tangible real-world environmental details, realistic crowding, signage, reflections, ambient location lighting`;

    const halloweenLine = isHalloween ? `, ${halloweenRealism}` : "";

    return [
      `Create a photoreal cosplay photo of a ${gender} cosplayer recreating the uploaded character reference.`,
      "Preserve the recognizable costume palette, silhouette, pose, hand placement, facial expression, and framing from the reference image.",
      `Translate it into a believable ${budget} cosplay with visible real fabrics, seams, accessories, and human proportions.`,
      `Scene: ${environmentDetails}.`,
      `${realismBoost}${halloweenLine}.`,
      "The final result should look like a real convention or location photoshoot, not concept art."
    ].join(" ");
  }

  async function loadBalance() {
    const apiKey = getApiKey();
    if (!apiKey) {
      balanceValue.textContent = "Waiting for key";
      balanceNote.textContent = "Balance appears after you save a Pollinations key.";
      setKeyStatus("Add a Pollinations publishable key to unlock generation and balance info.", false);
      updateGenerateState();
      return;
    }

    updateBalanceSummaryLoading();
    try {
      const balance = await fetchAccountBalance(apiKey);
      if (balance == null) {
        balanceValue.textContent = "Unavailable";
        balanceNote.textContent = "This key does not expose balance, or the account scope is limited.";
        setKeyStatus("Key saved locally. Generation can still work even if balance is hidden.", true);
        return;
      }

      balanceValue.textContent = `${formatPollenAmount(balance)} pollen`;
      balanceNote.textContent = "Current balance returned for your saved Pollinations key.";
      setKeyStatus("Key saved locally in this browser.", true);
    } catch (error) {
      balanceValue.textContent = "Unavailable";
      balanceNote.textContent = error.message;
      setKeyStatus("Key saved locally, but balance lookup failed.", true);
    }
  }

  async function loadModels() {
    const apiKey = getApiKey();
    imageModelSelect.disabled = true;
    imageModelSelect.innerHTML = '<option value="">Loading models…</option>';

    try {
      const models = await fetchImageModels(apiKey);
      imageModels = models;

      if (models.length === 0) {
        imageModelSelect.innerHTML = '<option value="">No compatible models available</option>';
        imageModelSelect.disabled = true;
        updateModelSummary();
        return;
      }

      imageModelSelect.innerHTML = "";
      models.forEach((model) => {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = `${model.id}${model.paidOnly ? " (paid)" : ""}`;
        imageModelSelect.appendChild(option);
      });

      imageModelSelect.value = models[0].id;
      imageModelSelect.disabled = false;
      updateModelSummary();
    } catch (error) {
      imageModels = [];
      imageModelSelect.innerHTML = '<option value="">Model load failed</option>';
      imageModelSelect.disabled = true;
      modelPriceValue.textContent = "Unavailable";
      modelPriceNote.textContent = error.message;
      updateGenerateState();
    }
  }

  async function saveApiKey() {
    const apiKey = getApiKey();
    if (!apiKey) {
      setStoredApiKey("");
      setKeyStatus("Enter a publishable key that starts with pk_.", false);
      balanceValue.textContent = "Waiting for key";
      balanceNote.textContent = "Balance appears after you save a Pollinations key.";
      await loadModels();
      return;
    }

    setStoredApiKey(apiKey);
    apiKeyNote.textContent = "Key saved locally in this browser. It will not be committed to GitHub Pages.";
    await Promise.all([loadModels(), loadBalance()]);
  }

  async function clearApiKey() {
    apiKeyInput.value = "";
    setStoredApiKey("");
    apiKeyNote.textContent = "Publishable keys are best for client-side apps like GitHub Pages.";
    setKeyStatus("Add a Pollinations publishable key to unlock generation and balance info.", false);
    balanceValue.textContent = "Waiting for key";
    balanceNote.textContent = "Balance appears after you save a Pollinations key.";
    await loadModels();
  }

  async function generate() {
    if (!referenceFile) {
      alert("Please provide a reference image first.");
      return;
    }
    if (!getApiKey()) {
      alert("Please save a Pollinations API key first.");
      return;
    }

    try {
      setLoading(true, "Uploading your reference image…");
      const referenceImageUrl = await uploadReferenceImage(referenceFile, getApiKey());

      setLoading(true, "Generating cosplay image…");
      const imageUrl = await generateCosplayImage({
        apiKey: getApiKey(),
        prompt: buildCosplayPrompt(),
        model: imageModelSelect.value,
        quality: imageQualitySelect.value,
        size: imageSizeSelect.value,
        referenceImageUrl
      });

      generatedImageUrl = imageUrl;
      outputImage.src = imageUrl;
      outputImage.classList.remove("hidden");
      outputPlaceholder.classList.add("hidden");
      outputMeta.textContent = `Model: ${imageModelSelect.value} • Quality: ${imageQualitySelect.value} • Size: ${imageSizeSelect.value}`;
      downloadLink.href = imageUrl;
      downloadLink.classList.remove("hidden");
      await loadBalance();
    } catch (error) {
      console.error("[generate] Failed:", error);
      resetOutput(error.message || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  imageDropper.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (event) => {
    handleFile(event.target.files?.[0] || null);
  });

  imageDropper.addEventListener("dragover", (event) => {
    event.preventDefault();
    imageDropper.classList.add("active");
  });

  imageDropper.addEventListener("dragleave", () => {
    imageDropper.classList.remove("active");
  });

  imageDropper.addEventListener("drop", (event) => {
    event.preventDefault();
    imageDropper.classList.remove("active");
    handleFile(event.dataTransfer?.files?.[0] || null);
  });

  pasteBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    try {
      if (!navigator.clipboard.read) {
        alert("This browser does not support clipboard image reads. Try Ctrl+V instead.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        handleFile(new File([blob], "clipboard-image.png", { type: blob.type || "image/png" }));
        return;
      }
      alert("No image found on the clipboard.");
    } catch (error) {
      console.error("[clipboard] Failed to read image:", error);
      alert("Clipboard paste failed. Please try Ctrl+V or upload a file instead.");
    }
  });

  document.addEventListener("paste", (event) => {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file) {
        handleFile(file);
      }
      break;
    }
  });

  saveKeyBtn.addEventListener("click", saveApiKey);
  clearKeyBtn.addEventListener("click", clearApiKey);
  generateBtn.addEventListener("click", generate);
  imageModelSelect.addEventListener("change", updateModelSummary);
  halloweenToggle.addEventListener("change", refreshLocations);

  outputImage.addEventListener("click", () => {
    if (!generatedImageUrl) return;
    fullscreenImage.src = generatedImageUrl;
    fullscreenView.classList.remove("hidden");
  });

  closeFullscreen.addEventListener("click", () => {
    fullscreenView.classList.add("hidden");
  });

  fullscreenView.addEventListener("click", (event) => {
    if (event.target === fullscreenView) {
      fullscreenView.classList.add("hidden");
    }
  });

  apiKeyInput.value = getStoredApiKey();
  refreshLocations();
  resetOutput("Save a key, upload a reference image, and generate your first cosplay shot.");

  Promise.all([loadModels(), loadBalance()]).finally(() => {
    updateGenerateState();
  });
});
