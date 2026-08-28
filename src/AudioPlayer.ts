import {
  getAudioContext,
  initAudio,
  initAudioOnFirstClick,
  registerSynthSounds,
  setAudioContext,
  setSuperdoughAudioController,
} from "@strudel/webaudio";
import React from "react";
import { useEffect } from "react";
import type { Song } from "./spoilers/Song";

export interface AudioPlayer {
  isPlaying: boolean;
  play: (notes: Song, songId?: string) => void;
  stop: () => Promise<void>;
  forcePlay: (notes: Song, songId?: string) => Promise<void>;
  currentSongId: string | null;
}

export function useAudioPlayer() {
  const [playlistEnd, setPlaylistEnd] = React.useState(-1);
  const [currentTimeout, setCurrentTimeout] = React.useState<number | null>(
    null,
  );
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

  function play(song: Song, startTime: number, songId?: string) {
    const now = getAudioContext().currentTime;
    const start = Math.max(now, startTime);

    song.play(start);
    const end = song.length() + start;

    setPlaylistEnd(end);
    setCurrentSongId(songId ?? null);

    setCurrentTimeout((timeout) => {
      if (timeout) window.clearTimeout(timeout);
      const newTimeout = window.setTimeout(
        () => {
          setCurrentTimeout(null);
          setCurrentSongId(null);
        },
        Math.ceil((end - now) * 1000),
      );
      return newTimeout;
    });
  }

  async function forcePlay(song: Song, songId?: string) {
    await stop();
    play(song, -1, songId);
  }

  return {
    isPlaying: currentTimeout !== null,
    play: (song: Song, songId?: string) => play(song, playlistEnd, songId),
    stop,
    forcePlay,
    currentSongId,
  };
}
