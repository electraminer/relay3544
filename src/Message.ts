import type { Pixel } from "./Image";
import type { Note } from "./Note";

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
  // Song of the message added by post processing
  song?: Note[];
}

export function processImage(signals: number[]): [Pixel[], number, number] | undefined {
  // Look for image
  for (let imageStart = 0; imageStart < signals.length; imageStart++) {
    if (signals[imageStart] !== -53) continue;
    if (signals[imageStart + 1] !== -14) continue;
    let i = imageStart + 2;
    const image: Pixel[] = [];
    let valid = true;
    while (signals[i] !== -15) {
      // Pixel
      if (signals[i++] !== -52) {
        valid = false;
        continue;
      };
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
    if (valid) return [image, imageStart, i];
  }
  return;
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


export function processSong(signals: number[]): [Note[], number, number] | undefined {
  // Look for song
  for (let songStart = 0; songStart < signals.length; songStart++) {
    if (signals[songStart] !== -577) continue;
    if (signals[songStart + 1] !== -14) continue;
    let i = songStart + 2;
    const song: Note[] = [];
    let valid = true;
    while (signals[i] !== -15) {
      // Note
      if (signals[i++] !== -605003) {
        valid = false;
        continue;
      }
      const note = [];
      for (let n = 0; n < 3; n++) {
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
        note.push(number * sign);
      }
      song.push({time: note[0], length: note[1], frequency: note[2]});
    }
    if (valid) return [song, songStart, i];
  }
  return;
}

export function processSongs(messages: Message[]): Message[] {
  return messages
    .map(m => {
      const songResult = processSong(m.signals);
      if (!songResult) return m;
      const [song, start, end] = songResult;
      const cutSong = [...m.signals.slice(0, start + 2), -25, ...m.signals.slice(end)];

      return {...m, signals: cutSong, tags: [...m.tags, "song"], song}
    });
}

export function filterChannels(messages: Message[], channel: number | null) {
  return messages
    .filter(m => (m.signals[0] !== -65535 && channel === null)
      || (m.signals[0] === -65535 && channel === m.signals[1])
      || channel === -65536)
    .map(m => channel !== -65536 || m.signals[0] !== -65535 ? m : {
      ...m, tags: [...m.tags, "secret"]
    });
}