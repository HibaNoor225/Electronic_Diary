const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const verifyToken = require("../middleware/authMiddleware");

router.post('/generate-story', verifyToken, async (req, res) => {
  const { prompt, tone, style, length } = req.body;

  // Validate request parameters
  if (!prompt || !tone || !style || !length) {
    return res.status(400).json({ error: 'Missing required parameters: prompt, tone, style, and length are required' });
  }

  // Validate tone
  const validTones = [
    'reflective', 'friendly', 'professional', 'casual', 'formal',
    'playful', 'emotional', 'melancholic', 'optimistic', 'adventurous', 'inspirational'
  ];
  if (!validTones.includes(tone.toLowerCase())) {
    return res.status(400).json({ error: `Invalid tone. Must be one of: ${validTones.join(', ')}` });
  }

  // Validate style
  const validStyles = [
    'descriptive', 'minimal', 'narrative', 'poetic', 'modern',
    'dramatic', 'reflective', 'humorous', 'diary-style'
  ];
  if (!validStyles.includes(style.toLowerCase())) {
    return res.status(400).json({ error: `Invalid style. Must be one of: ${validStyles.join(', ')}` });
  }

  // Validate length and set word count
const validLengths = {
  short: '3-4 sentences',
  medium: '7-8 sentences',
  long: '10-12 sentences'
};

  if (!validLengths[length.toLowerCase()]) {
    return res.status(400).json({ error: `Invalid length. Must be one of: ${Object.keys(validLengths).join(', ')}` });
  }

  try {
    // Initialize the Gemini model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Use role-content format instead of a single string
    // Instead of role-content objects, use Gemini's expected format
const contents = [
  {
    role: "user",
    parts: [
      { text: [
        'You are a creative storyteller for a personal diary app.',
        'Generate a coherent, engaging story or event description based on the following user input.',
        `Use a ${tone} tone throughout.`,
        `Write in a ${style} style.`,
        `Structure it as a proper paragraph or short narrative (${validLengths[length.toLowerCase()]}).`,
        'Make it vivid, clear, and well-structured with a beginning, middle, and end.',
        'Ensure the language is natural, **simple, and easy to understand** — avoid complicated or academic words.',
        'Keep sentences clear and conversational, like how someone would actually write in their diary.',
        'Avoid any placeholders or incomplete sentences.',
        `User input: ${prompt}`
      ].join('\n') }
    ]
  }
];


const result = await model.generateContent({ contents });
const text = result.response.text().trim();

    // Send the generated text
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate content', details: err.message });
  }
});

module.exports = router;
