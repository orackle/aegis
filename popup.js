let model; // Global variable for TensorFlow model

// Function to load TensorFlow model
async function loadModel() {
  if (model) return model; // Avoid reloading if already loaded
  try {
    model = await tf.loadLayersModel(chrome.runtime.getURL("tfjs_model/model.json"));
    console.log("✅ Model loaded successfully");
    return model;
  } catch (error) {
    console.error("❌ Error loading model:", error);
  }
}

// Function to preprocess the text for the TensorFlow model
function preprocessText(text) {
  const tokens = text.toLowerCase().split(" ");
  const vocab = { "this": 1, "one": 2, "trick": 3, "will": 4, "change": 5, "your": 6, "life": 7 }; // Simplified vocab
  const indices = tokens.map(token => vocab[token] || 0); // Assign index to each token

  console.log("🔠 Tokenized Input:", indices);

  let tensor = tf.tensor1d(indices, 'int32');

  if (tensor.shape[0] < 100) {
    tensor = tf.pad(tensor, [[0, 100 - tensor.shape[0]]]); // Pad if length < 100
  } else {
    tensor = tensor.slice([0], [100]); // Trim if length > 100
  }

  return tensor.reshape([1, 100]); // Reshape for model input
}

// Function to detect clickbait using the TensorFlow model
async function detectClickbait(text) {
  if (!model) {
    console.warn("⚠️ Model not loaded yet. Loading now...");
    await loadModel();
  }

  if (!model) {
    console.error("❌ Could not load model.");
    return "Error: Model not loaded.";
  }

  const inputTensor = preprocessText(text);
  console.log("🔄 Model Input Tensor:", inputTensor.arraySync());

  const prediction = model.predict(inputTensor);
  const probability = prediction.dataSync()[0]; // Clickbait probability

  console.log("📊 Model Prediction:", probability);

  return probability > 0.5 ? "🚨 Clickbait" : "✅ Not Clickbait";
}

// Function to extract content from the page (headline + article)
function extractContent() {
  const headline = document.querySelector("h1")?.innerText || "";
  const articleContent = document.querySelector("article")?.innerText || "";
  return `${headline} ${articleContent}`;
}

// Event listener for the "Check Clickbait" button
document.getElementById("checkClickbait").addEventListener("click", async () => {
  const resultElement = document.getElementById("result");
  resultElement.innerHTML = "<span class='loading'>🔍 Analyzing...</span>";
  resultElement.classList.remove("show");

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractContent
    });

    const content = response[0]?.result;
    console.log("📝 Extracted Content:", content); // Debugging log

    if (!content) {
      resultElement.innerHTML = "<span class='error'>❌ No content found.</span>";
      resultElement.classList.add("show");
      return;
    }

    // ✅ First, check with TensorFlow model
    const tfPrediction = await detectClickbait(content);
    console.log("🧠 TensorFlow Prediction:", tfPrediction);

    // If TensorFlow model already predicts "Not Clickbait", no need to call API
    if (tfPrediction === "✅ Not Clickbait") {
      resultElement.innerHTML = `
        <div class="analysis">
          <h3>🧠 TensorFlow Model</h3>
          <p>${tfPrediction}</p>
        </div>
      `;
      resultElement.classList.add("show");
      return;
    }

    // Otherwise, call Groq API for additional analysis
    const encodedApiKey = "Z3NrX0pEWEpPc0tzQklQUm5BRVozY0FFV0dkeWIzRlk5NzB1NHpCSFdvbTRCS2I5aG9YckxhaWQ=";
    const apiKey = atob(encodedApiKey);

    const apiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: `Analyze this content for clickbait: ${content}. Respond with "Yes" or "No" and a short reason.` }]
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`Groq API Error: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    console.log("📊 Groq API Response:", data); // Debugging log

    const aiAnalysis = data.choices?.[0]?.message?.content || "Error analyzing content.";

    resultElement.innerHTML = `
      <div class="analysis">
        <h3>🧠 TensorFlow Model</h3>
        <p>${tfPrediction}</p>
        <h3>🤖 Groq AI Analysis</h3>
        <p>${aiAnalysis}</p>
      </div>
    `;
    resultElement.classList.add("show");

  } catch (error) {
    console.error("❌ Error analyzing content:", error);
    resultElement.innerHTML = "<span class='error'>❌ Error analyzing content.</span>";
    resultElement.classList.add("show");
  }
});
