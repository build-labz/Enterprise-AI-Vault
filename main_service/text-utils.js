function splitTextAtSentencesAdvanced(text, targetLength = 4096) {
  if (!text || typeof text !== 'string') return [];
  if (text.length <= targetLength) return [text];

  const chunks = [];
  let currentChunk = "";

  // Regex explanation:
  // 1. [^.!?]+       : Match everything that is not a sentence ender
  // 2. [^.!?]+[.!?]+ : Match up to and including the sentence punctuation
  // 3. ["']?         : Match an optional closing quote
  // 4. \s*           : Match trailing spaces/newlines after the sentence
  // 5. |[^.!?]+$     : Fallback to match any remaining text without punctuation at the very end
  const sentenceRegex = /[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [];

  for (const sentence of sentences) {
    // If adding this sentence keeps us under the target length, add it
    if ((currentChunk + sentence).length <= targetLength) {
      currentChunk += sentence;
    } else {
      // If the current chunk is not empty, push it to the array
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
      }

      // Start a new chunk with the current sentence
      currentChunk = sentence;

      // Fallback: If a single sentence is strictly longer than the targetLength,
      // we push it as its own chunk.
      if (currentChunk.length > targetLength) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
    }
  }

  // Push the final remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Export the function
export {
  splitTextAtSentencesAdvanced
};