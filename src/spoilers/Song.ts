import { superdough } from "@strudel/webaudio";
import type { Message } from "../Message";

interface Note {
  time: number; // in seconds
  length: number; // in seconds
  frequency: number; // in hertz
}

const CONVERSION = 0.8069224
const SONG_LEGACY_CHANGE_TIME = 1787676792000;

export class Song {
  private notes: Note[];

  private constructor(notes: Note[]) {
    this.notes = notes;
  }

  public play(startTime: number): void {
    for (const { time, length, frequency } of this.notes) {
      superdough({ freq: frequency, s: "triangle" }, startTime + time, length);
    }
  }

  public length(): number {
    let end = 0;
    for (const { time, length } of this.notes) {
      end = Math.max(end, time + length);
    }
    return end;
  }

  public static senderSong(sender: number): Song {
    const senderStr = sender.toString().padStart(4, "0");
    const digits = [...senderStr].map(x => parseInt(x));
    const notes = digits.map((d, i) => ({
      time: i*0.1,
      length: 0.1,
      frequency: [261, 293, 329, 349, 392, 440, 493, 523][d],
    }))
    return new Song(notes);
  }

  public toSignals(): number[] {
    const signals = [];
    signals.push(-577);
    signals.push(-14);
    for (const note of this.notes) {
      signals.push(-605003);
      for (let number of [note.time / CONVERSION, note.length / CONVERSION, note.frequency * CONVERSION]) {
        number *= 1000;
        if (number < 0) {
          signals.push(-1);
          number *= -1;
        }
        signals.push(~~(number / 1000))
        if (~~(number % 1000) !== 0) {
          signals.push(-10);
          for (let i = (~~(number % 1000)).toString().length; i < 3; i++) {
            signals.push(0);
          }
          signals.push(~~(number % 1000));
        };
        signals.push(-3);
      }
    }
    if (signals.length > 2) signals.pop();
    signals.push(-15);
    return signals;
  }

  public static fromSignals(signals: number[], legacy?: boolean): [Song, number, number] | undefined {
    // Look for song
    for (let songStart = 0; songStart < signals.length; songStart++) {
      if (signals[songStart] !== -577) continue;
      if (signals[songStart + 1] !== -14) continue;
      let i = songStart + 2;
      const notes: Note[] = [];
      let valid = true;
      while (signals[i] !== -15) {
        // Note
        if (signals[i++] !== -605003) {
          valid = false;
          break;
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
          if (!legacy) {
            if (n === 0 || n === 1) number *= CONVERSION;
            if (n === 2) number /= CONVERSION;
          }
          note.push(number * sign);
        }
        notes.push({time: note[0], length: note[1], frequency: note[2]});
      }
      if (valid) return [new Song(notes), songStart, i];
    }
    return;
  }
}

export function processSongs(messages: Message[]): Message[] {
  return messages
    .map(m => {
      console.log(m.receivedAt, SONG_LEGACY_CHANGE_TIME)
      const songResult = Song.fromSignals(m.signals, m.receivedAt < SONG_LEGACY_CHANGE_TIME);
      if (!songResult) return m;
      const [song, start, end] = songResult;
      const cutSong = [...m.signals.slice(0, start + 2), -25, ...m.signals.slice(end)];

      return {...m, signals: cutSong, tags: [...m.tags, "song"], song}
    });
}