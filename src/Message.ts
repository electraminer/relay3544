import type { Image } from "./spoilers/Image";
import type { Song } from "./spoilers/Song";

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
  image?: Image;
  // Song of the message added by post processing
  song?: Song;
  songSignals?: number[];
}