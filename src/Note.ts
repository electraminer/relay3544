import {
  getAudioContext,
  initAudioOnFirstClick,
  registerSynthSounds,
  superdough,
} from "@strudel/webaudio";

export interface Note {
  time: number; // in seconds
  length: number; // in seconds
  frequency: number; // in hertz
}

let initialized = false;

export function playNotes(notes: Note[], sample?: string) {
  if (!initialized) {
    initAudioOnFirstClick();
    registerSynthSounds();
    initialized = true;
  }
  const start = getAudioContext().currentTime;
  for (const { time, length, frequency } of notes) {
    superdough({ freq: frequency, s: sample ?? "triangle" }, start + time, length);
  }
}

const freq = [261, 293, 329, 349, 392, 440, 493, 523];

export function senderSong(sender: number): Note[] {
  const senderStr = sender.toString().padStart(4, "0");
  const digits = [...senderStr].map(x => parseInt(x));
  const song = digits.map((d, i) => ({
    time: i*0.1,
    length: 0.1,
    frequency: freq[d],
  }))
  return song;
}

export function songToSignals(song: Note[]): number[] {
  const signals = [];
  signals.push(-577);
  signals.push(-14);
  for (const note of song) {
    signals.push(-605003);
    for (let number of [note.time, note.length, note.frequency]) {
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
  signals.pop();
  signals.push(-15);
  return signals;
}