require('dotenv').config();
const HF_API_URL = "https://api-inference.huggingface.co/models/distilgpt2";
const HF_TOKEN = process.env.HF_API_KEY;

async function testHF() {
  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: "Write a short diary entry about a sunny day."
      })
    });

    console.log("Status:", response.status);
    const text = await response.text();  // read raw text
    console.log("Response body:", text);

  } catch (err) {
    console.error("Error:", err);
  }
}

testHF();
