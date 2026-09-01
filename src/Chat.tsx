import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { MessageHistory, type Message } from "./Message";
import { entryStyle, type DictEntry } from "./Dictionary";
import { TooltipWrap } from "./Tooltip";
import { type AudioPlayer } from "./AudioPlayer";
import { decompile, doubleSeparator, separator } from "./converter";
import { processCommands } from "./spoilers/Command";
import { processSongs, Song } from "./spoilers/Song";
import { processImages, type Image } from "./spoilers/Image";
import {
  displayedInsideChannel,
  filterByChannel,
  processChannel,
} from "./spoilers/Channel";

const INITIAL_MESSAGE_COUNT = 64;
const LOAD_STEP = 64;
const SCROLL_EDGE_THRESHOLD = 1000;
const SCROLL_START_THRESHOLD = 40;

export function Chat(props: {
  messages: MessageHistory;
  dictionary: Map<number, DictEntry>;
  self: number;
  channel: number | null;
  online: Set<number>;
  onSelectSignal: (signal: number) => void;
  onViewImage: (image: Image) => void;
  audio: AudioPlayer;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_MESSAGE_COUNT);
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreScrollRef = useRef<number>(0);
  const pendingBottomRef = useRef(false);

  const [readTime, setReadTime] = useState(Date.now());

  const messages = props.messages.getMessagesAndLoadLater(
    visibleCount,
    filterByChannel(props.channel),
  );
  const unread = messages.filter((x) => x.receivedAt > readTime).length;

  let processed = messages;
  processed = processChannel(processed, props.channel);
  processed = processCommands(processed);
  processed = processImages(processed);
  processed = processSongs(processed);

  const [isScrolling, setIsScrolling] = useState(false);

  // When more (older) messages are prepended, keep the previously-visible
  // content in place instead of letting the scroll position jump. When the
  // "scroll to bottom" button was clicked, jump straight to the bottom.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (pendingBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      pendingBottomRef.current = false;
      restoreScrollRef.current = 0;
      setReadTime(Date.now());
      return;
    }
    const restore = restoreScrollRef.current;
    el.scrollTop = el.scrollHeight - restore;
  }, [messages.length, pendingBottomRef.current]);

  // Autoscroll to the newest message, but only while no extra history has
  // been lazy-loaded — otherwise a new message would yank the view away
  // from whatever the user scrolled up to read.
  useLayoutEffect(() => {
    if (isScrolling) {
      setVisibleCount(visibleCount + 1);
      return;
    }
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setIsScrolling(false);
    setReadTime(Date.now());
  }, [unread, props.messages.version === 0]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const isScrolling =
      el.scrollHeight - (el.scrollTop + el.clientHeight) >=
      SCROLL_START_THRESHOLD;
    setIsScrolling(isScrolling);
    if (isScrolling && el.scrollTop <= SCROLL_EDGE_THRESHOLD) {
      restoreScrollRef.current = el.scrollHeight - el.scrollTop;
      setVisibleCount((count) => count + LOAD_STEP);
    } else if (!isScrolling && visibleCount > INITIAL_MESSAGE_COUNT) {
      setVisibleCount(INITIAL_MESSAGE_COUNT);
    }
  }

  function handleScrollToBottom() {
    pendingBottomRef.current = true;
    setVisibleCount(INITIAL_MESSAGE_COUNT);
    setReadTime(Date.now());
  }

  return (
    <div className="chat-wrap">
      <div className="chat" ref={containerRef} onScroll={handleScroll}>
        {processed.map((message, i) => (
          <Message
            key={i}
            message={{
              ...message,
              signals: displayedInsideChannel(message.signals, props.channel),
            }}
            dictionary={props.dictionary}
            self={props.self}
            online={props.online}
            onSelectSignal={props.onSelectSignal}
            onViewImage={props.onViewImage}
            audio={props.audio}
          />
        ))}
      </div>
      {isScrolling && (
        <button className="scroll-to-bottom" onClick={handleScrollToBottom}>
          ↓ {unread}
        </button>
      )}
    </div>
  );
}

export function Message(props: {
  message: Message;
  dictionary: Map<number, DictEntry>;
  online: Set<number>;
  self: number;
  onSelectSignal: (signal: number) => void;
  onViewImage: (image: Image) => void;
  audio: AudioPlayer;
}): React.ReactNode {
  const messageId = `${props.message.receivedAt} ${props.message.id}`;
  return (
    <div
      className={`message
      ${props.message.tags.map((t) => `message--${t}`).join(" ")}
      ${props.message.sender === props.self && "message--self"}
  `}
    >
      <TooltipWrap
        tooltip={new Date(props.message.receivedAt).toLocaleString()}
      >
        <span className="message-time">
          {props.message.id.toString().padStart(3, "0")}
        </span>
      </TooltipWrap>
      <TooltipWrap
        onClick={() => props.onSelectSignal(props.message.sender)}
        tooltip={props.message.sender}
      >
        <Sender
          audio={props.audio}
          sender={props.message.sender}
          dictionary={props.dictionary}
        />
      </TooltipWrap>
      <Text
        audio={props.audio}
        signals={props.message.signals}
        dictionary={props.dictionary}
        online={props.online}
        onSelectSignal={props.onSelectSignal}
      />
      {props.message.image && (
        <span
          className="message-button message-viewimage"
          onClick={() => props.onViewImage(props.message.image!)}
        >
          <span className="material-symbols-outlined">visibility</span>
        </span>
      )}
      {props.message.image && (
        <span
          className="message-button message-viewimage"
          onClick={() =>
            navigator.clipboard.writeText(
              decompile(
                props.message.image!.toSignals().join(" "),
                props.dictionary,
              ),
            )
          }
        >
          <span className="material-symbols-outlined">content_copy</span>
        </span>
      )}
      {props.message.song && (
        <span
          className="message-button message-playsong"
          onClick={() => {
            if (props.audio.currentSongId === messageId) {
              props.audio.stop();
            } else {
              props.audio.forcePlay(props.message.song!, messageId);
            }
          }}
        >
          <span className="material-symbols-outlined">
            {props.audio.currentSongId === messageId
              ? `music_note_2`
              : `play_arrow`}
          </span>
        </span>
      )}
      {props.message.song && (
        <span
          className="message-button message-playsong"
          onClick={() =>
            navigator.clipboard.writeText(
              decompile(props.message.songSignals!.join(" "), props.dictionary),
            )
          }
        >
          <span className="material-symbols-outlined">content_copy</span>
        </span>
      )}
    </div>
  );
}

export function Sender(props: {
  sender: number;
  dictionary: Map<number, DictEntry>;
  audio: AudioPlayer;
}): React.ReactNode {
  const senderCode = props.sender.toString().padStart(4, "0");
  return (
    <span
      className="sender"
      onClick={() => props.audio.forcePlay(Song.senderSong(props.sender))}
      style={(() => {
        const code = [...senderCode].map((x) => parseInt(x));
        return {
          backgroundColor: `rgb(${code[1] * 2 * (7 - code[0])}, ${code[2] * 2 * (7 - code[0])}, ${code[3] * 2 * (7 - code[0])}`,
          color: `rgb(${code[1] * 24 + 64}, ${code[2] * 16 + 64}, ${code[3] * 24 + 64})`,
        };
      })()}
    >
      {props.dictionary.get(props.sender)?.def ?? senderCode}
    </span>
  );
}

export function Text(props: {
  signals: number[];
  dictionary: Map<number, DictEntry>;
  online: Set<number>;
  audio: AudioPlayer;
  onSelectSignal: (signal: number) => void;
}): React.ReactNode {
  function textSignalStyle(signal: number): object {
    if (!props.dictionary.has(signal)) {
      signal = signal < 0 ? -Infinity : Infinity;
    }
    return entryStyle(props.dictionary.get(signal)!);
  }
  return (
    <span className="text">
      {props.signals.map((signal, i) => (
        <Fragment key={i}>
          <TooltipWrap
            onClick={() => {
              const isHuman = signal >= 10 && props.online.has(signal);
              if (!props.dictionary.has(signal) && !isHuman && signal >= 0)
                return;
              props.onSelectSignal(signal);
            }}
            tooltip={signal}
          >
            {props.online.has(signal) && signal >= 10 ? (
              <Sender
                audio={props.audio}
                sender={signal}
                dictionary={props.dictionary}
              />
            ) : (
              <span className="text-signal" style={textSignalStyle(signal)}>
                {props.dictionary.get(signal)?.def ?? signal}
              </span>
            )}
          </TooltipWrap>
          {i < props.signals.length && (
            <span>
              {separator(signal, props.signals[i + 1], props.dictionary)}
            </span>
          )}
          {i > 0 && (
            <span>
              {doubleSeparator(props.signals[i - 1], signal, props.dictionary)}
            </span>
          )}
        </Fragment>
      ))}
    </span>
  );
}
