import { superdough } from "@strudel/webaudio";
import type { Message } from "../Message";
import { parseCollection, parseGroup, parseNumber, Peekable } from "./Parser";

interface Note {
  time: number; // in seconds
  length: number; // in seconds
  frequency: number; // in hertz
}

const CONVERSION = 0.8069224 // Songs are now in Alien units
const SONG_LEGACY_CHANGE_TIME = 1787676792000; // Songs posted before this timestamp still use the legacy Human units

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
    const i = new Peekable(signals);

    while (i.peek() !== undefined) {
      let songStart = i.position;
      if (i.next() === -577) {
        let notes = i.match(parseGroup(parseCollection(parseNote, -3, false)));
        if (!notes) continue;
        if (!legacy) {
          notes = notes.map(n => ({
            time: n.time * CONVERSION,
            length: n.length * CONVERSION,
            frequency: n.frequency * CONVERSION,
          }));
        }
        return [new Song(notes), songStart, i.position-1];
      }
    }
    return;
  }
}


function parseNote(i: Peekable): Note | undefined {
  if (!i.matchExact(-605003)) return;

  const time = i.match(parseNumber) ?? 0;

  if (!i.matchExact(-3)) return;

  const length = i.match(parseNumber) ?? 0;

  if (!i.matchExact(-3)) return;

  const frequency = i.match(parseNumber) ?? 0;

  return {time, length, frequency};
}

export function processSongs(messages: Message[]): Message[] {
  return messages
    .map(m => {
      const songResult = Song.fromSignals(m.signals, m.receivedAt < SONG_LEGACY_CHANGE_TIME);
      if (!songResult) return m;
      const [song, start, end] = songResult;
      const cutSong = [...m.signals.slice(0, start + 2), -25, ...m.signals.slice(end)];

      return {...m, signals: cutSong, tags: [...m.tags, "song"], song}
    });
}