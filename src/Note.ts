import {
  getAudioContext,
  initAudio,
  initAudioOnFirstClick,
  registerSynthSounds,
  setAudioContext,
  setSuperdoughAudioController,
  superdough,
} from "@strudel/webaudio";
import React from "react";
import { useEffect } from "react";

export interface Note {
  time: number; // in seconds
  length: number; // in seconds
  frequency: number; // in hertz
}

export interface AudioPlayer {
  isPlaying: boolean;
  play: (notes: Note[], songId?: string) => void;
  stop: () => Promise<void>;
  forcePlay: (notes: Note[], songId?: string) => Promise<void>;
  currentSongId: string | null;
}

export function useAudioPlayer() {

  const [playlistEnd, setPlaylistEnd] = React.useState(-1);
  const [currentTimeout, setCurrentTimeout] = React.useState<number | null>(null);
  const [counter, setCounter] = React.useState(0);
  const [currentSongId, setCurrentSongId] = React.useState<string | null>(null);

  useEffect(() => {
    initAudioOnFirstClick();
    registerSynthSounds();
  }, []);

  async function stop() {
    if (currentTimeout) window.clearTimeout(currentTimeout);
    setCurrentTimeout(null);
    setPlaylistEnd(-1);
    setCurrentSongId(null);
    const oldContext = getAudioContext();
    await oldContext.close();
    setAudioContext(new AudioContext());
    setSuperdoughAudioController(undefined);
    await initAudio();
  }

  function play(notes: Note[], startTime: number, songId?: string) {
    const now = getAudioContext().currentTime;
    const start = Math.max(now, startTime);
    let end = start;
    for (const { time, length, frequency } of notes) {
      superdough({ freq: frequency, s: "triangle" }, start + time, length);
      end = Math.max(end, start + time + length);
    }
    setPlaylistEnd(end);
    setCurrentSongId(songId ?? null);

    setCurrentTimeout(timeout => {
      if (timeout) window.clearTimeout(timeout);
      const newTimeout = window.setTimeout(() => {
        setCurrentTimeout(null);
        setCurrentSongId(null);
      }, Math.ceil((end - now)*1000));
      return newTimeout;
    });

    setCounter(counter => counter + 1);
  }

  async function forcePlay(notes: Note[], songId?: string) {
    await stop();
    console.log("force");
    play(notes, -1, songId);
  }

  console.log(playlistEnd, currentTimeout, counter);

  return {
    isPlaying: currentTimeout !== null,
    play: (notes: Note[], songId?: string) => play(notes, playlistEnd, songId),
    stop,
    forcePlay,
    currentSongId,
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
  if (signals.length > 2) signals.pop();
  signals.push(-15);
  return signals;
}