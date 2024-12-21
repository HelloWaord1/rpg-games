const MAX_MESSAGE_LENGTH = 4000; // Telegram's limit is 4096 characters

class MessageUtils {
  static splitMessage(text) {
    if (text.length <= MAX_MESSAGE_LENGTH) {
      return [text];
    }

    const parts = [];
    let currentPart = '';
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if ((currentPart + sentence).length > MAX_MESSAGE_LENGTH) {
        if (currentPart) {
          parts.push(currentPart.trim());
          currentPart = '';
        }
        // If a single sentence is too long, split by space
        if (sentence.length > MAX_MESSAGE_LENGTH) {
          const words = sentence.split(' ');
          for (const word of words) {
            if ((currentPart + ' ' + word).length > MAX_MESSAGE_LENGTH) {
              parts.push(currentPart.trim());
              currentPart = word;
            } else {
              currentPart += (currentPart ? ' ' : '') + word;
            }
          }
        } else {
          currentPart = sentence;
        }
      } else {
        currentPart += (currentPart ? ' ' : '') + sentence;
      }
    }

    if (currentPart) {
      parts.push(currentPart.trim());
    }

    return parts;
  }
}

module.exports = MessageUtils;