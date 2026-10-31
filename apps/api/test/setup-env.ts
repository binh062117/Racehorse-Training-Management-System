// e2e runs never call the real AI service: with the key empty, the proactive
// risk check skips quietly instead of waiting on the network on every exam.
// (Set, not deleted — dotenv only fills keys that are absent.)
process.env.GROQ_API_KEY = '';
