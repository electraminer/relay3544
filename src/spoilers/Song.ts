import { superdough } from "@strudel/webaudio";
import type { Message } from "../Message";
import { parseCollection, parseGroup, parseNumber, Peekable } from "./Parser";

interface Note {
  time: number; // in seconds
  length: number; // in seconds
  frequency: number; // in hertz
}

const CONVERSION = 0.8069224; // Songs are now in Alien units
const SONG_LEGACY_CHANGE_TIME = 1787676792000; // Songs posted before this timestamp still use the legacy Human units

export class Song {
  private notes: Note[];

  private constructor(notes: Note[]) {
    this.notes = notes;
  }

  public play(startTime: number): void {
    for (const { time, length, frequency } of this.notes) {
      if (frequency === 0) continue;
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

  private unitConvert(conversion: number) {
    return new Song(
      this.notes.map((x) => ({
        time: x.time * conversion,
        length: x.length * conversion,
        frequency: x.frequency / conversion,
      })),
    );
  }

  private shift(time: number) {
    return new Song(
      this.notes.map((x) => ({
        time: x.time + time,
        length: x.length,
        frequency: x.frequency,
      })),
    );
  }

  // private scale(scale: number) {
  //   return new Song(this.notes.map(x => ({
  //     time: x.time * scale,
  //     length: x.length * scale,
  //     frequency: x.frequency,
  //   })));
  // }

  private append(song: Song) {
    return new Song([...this.notes, ...song.shift(this.length()).notes]);
  }

  static parseNote(i: Peekable<Song>): Note | undefined {
    if (!i.matchExact(-605003)) return;

    const time = i.match(parseNumber) ?? 0;
    if (!i.matchExact(-3)) return;
    const length = i.match(parseNumber) ?? 0;
    if (!i.matchExact(-3)) return;
    const frequency = i.match(parseNumber) ?? 0;

    return { time, length, frequency };
  }

  static parseSongItem(i: Peekable<Song>): Song | undefined {
    const note = i.match(Song.parseNote);
    if (note) return new Song([note]);
    const varDecl = i.match(Song.parseSongVarDecl);
    if (varDecl) return varDecl;
    const varValue = i.match(Song.parseSongVar);
    if (varValue) return varValue;

    return i.match(Song.parseSongGroup);
  }

  static parseSongChord(i: Peekable<Song>): Song | undefined {
    const group = i.match(parseCollection(Song.parseSongItem, -3, false));
    if (group) return new Song(group.flatMap((x) => x.notes));
  }

  static parseSongSequence(i: Peekable<Song>): Song | undefined {
    const group = i.match(parseCollection(Song.parseSongChord, -122, true));
    if (group) return group.reduce((a, b) => a.append(b));
  }

  static parseSongGroup(i: Peekable<Song>): Song | undefined {
    return i.match(parseGroup(Song.parseSongSequence));
  }

  static parseSongVarDecl(i: Peekable<Song>): Song | undefined {
    if (!i.matchExact(-11)) return;
    const varIndex = i.match(parseNumber);
    if (varIndex === undefined) return;
    const group = i.match(Song.parseSongGroup);
    if (!group) return;
    if (!i.setVar(varIndex, group)) return;
    return group;
  }

  static parseSongVar(i: Peekable<Song>): Song | undefined {
    if (!i.matchExact(-11)) return;
    const varIndex = i.match(parseNumber);
    if (varIndex === undefined) return;
    return i.getVar(varIndex);
  }

  public static fromSignals(
    signals: number[],
    legacy?: boolean,
  ): [Song, number, number, number[]] | undefined {
    // Look for song
    const i = new Peekable<Song>(signals);

    while (i.peek() !== undefined) {
      let songStart = i.position;
      if (i.next() === -577) {
        let song = i.match(Song.parseSongGroup);
        if (!song) continue;
        if (!legacy) {
          song = song.unitConvert(CONVERSION);
        }
        return [
          song,
          songStart,
          i.position - 1,
          signals.slice(songStart, i.position),
        ];
      }
    }
    return;
  }

  public static senderSong(sender: number): Song {
    const senderStr = sender.toString().padStart(4, "0");
    const digits = [...senderStr].map((x) => parseInt(x));
    const notes = digits.map((d, i) => ({
      time: i * 0.1,
      length: 0.1,
      frequency: [261, 293, 329, 349, 392, 440, 493, 523][d],
    }));
    return new Song(notes);
  }
}

export function processSongs(messages: Message[]): Message[] {
  return messages.map((m) => {
    const songResult = Song.fromSignals(
      m.signals,
      m.receivedAt < SONG_LEGACY_CHANGE_TIME,
    );
    if (!songResult) return m;
    const [song, start, end, songSignals] = songResult;
    const cutSong = [
      ...m.signals.slice(0, start + 2),
      -25,
      ...m.signals.slice(end),
    ];

    return {
      ...m,
      signals: cutSong,
      tags: [...m.tags, "song"],
      song,
      songSignals,
    };
  });
}
