import type { Pixel } from "./Image";

export interface Message {
  // When the message was recieved.
  receivedAt: number;
  // The numeric id of the message (visual only for reference)
  id: number;
  // The sender of the message (decimal form)
  sender: number;
  // The signals of the message
  signals: number[];
  // Tags of the message added by post processing
  tags: string[];
  // Image of the message added by post processing
  image?: Pixel[];
}

/**
 * Processes message edits ( MISTAKE [ find ] CORRECTION [ replace ] messageid )
 * @param messages The raw messages
 * @returns a new array of processed messages post-edits
 */
export function processEdits(messages: Message[]) {
  const processed: Message[] = [];

  for (const message of messages) {
    // Copy the message
    processed.push({...message});

    // Mistake/Correction 
    if (message.signals[0] !== -157401) continue;
    const i = message.signals.findIndex(signal => signal === -157402);
    if (i < 0) continue;
    // Check for message number at end
    let last = message.signals.length - 1;
    let number = 0;
    let power = 1;
    while (message.signals[last] >= 0) {
      number += message.signals[last] * power;
      power *= 10;
      last--;
    }
    // Check brackets
    if (message.signals[1] !== -14) continue;
    if (message.signals[i-1] !== -15) continue;
    const find = message.signals.slice(2, i-1);
    if (message.signals[i+1] !== -14) continue;
    if (message.signals[last] !== -15) continue;
    const replace = message.signals.slice(i+2, last);

    // Find message to edit
    for (let i = processed.length - 1; i--; i >= 0) {
      const m = processed[i];
      if (m.sender === message.sender
        && (m.id === number || last === message.signals.length - 1)) {
        // Apply edit
        const signals = m.signals;
        const newSignals = [];
        for (let i = 0; i < signals.length; i++) {
          // Check if the find is accurate
          let match = true;
          for (let j = 0; j < find.length; j++) {
            if (signals[i + j] !== find[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            // Replace
            newSignals.push(...replace);
            i += find.length - 1;
          } else {
            // Copy over
            newSignals.push(signals[i])
          }
        }
        m.signals = newSignals;
        // Mark as command
        const command = processed.at(-1)!;
        command.tags = [...command.tags, "command"];
        break;
      }
    }
  }

  return processed;
}

export function processImage(signals: number[]): [Pixel[], number, number] | undefined {
  // Look for image
  const imageStart = signals.findIndex(signal => signal === -53);
  if (imageStart < 0) return;
  if (signals[imageStart + 1] !== -14) return;
  let i = imageStart + 2;
  const image: Pixel[] = [];
  while (signals[i] !== -15) {
    // Pixel
    if (signals[i++] !== -52) return;
    const pixel = [];
    for (let n = 0; n < 5; n++) {
      let sign = 1;
      let number = 0;
      let precision = 1;
      if (signals[i] === -1) {
        sign = -1;
        i++;
      }
      while (signals[i] >= 0) {
        const digit = signals[i];
        number *= Math.pow(10, digit.toString().length)
        number += digit;
        i++;
      }
      if (signals[i] === -10) {
        i++;
        while (signals[i] >= 0) {
          const digit = signals[i];
          precision /= Math.pow(10, digit.toString().length)
          number += precision * digit;
          i++;
        }
      }
      if (signals[i] === -3) {
        i++;
      }
      pixel.push(number * sign);
    }
    image.push({x: pixel[0], y: pixel[1], z: pixel[2], size: pixel[3], color: pixel[4]});
  }
  return [image, imageStart, i];
}

export function processImages(messages: Message[]): Message[] {
  return messages
    .map(m => {
      const imageResult = processImage(m.signals);
      if (!imageResult) return m;
      const [image, start, end] = imageResult;
      const cutImage = [...m.signals.slice(0, start + 2), -25, ...m.signals.slice(end)];

      return {...m, signals: cutImage, tags: [...m.tags, "image"], image}
    });
}

export function filterSecrets(messages: Message[], secrets: Set<number>) {
  return messages
    .filter(m => m.signals[0] !== -65535 || secrets.has(m.signals[1]) || secrets.has(-65536))
    .map(m => m.signals[0] !== -65535 ? m : {
      ...m, tags: [...m.tags, "secret"]
    });
}