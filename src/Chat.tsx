import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { filterChannels, processEdits, processImages, processSongs, type Message } from "./Message";
import { imageToSignals, type Pixel } from "./Image";
import type { DictEntry } from "./Dictionary";
import { TooltipWrap } from "./Tooltip";
import { playNotes, senderSong, songToSignals } from "./Note";
import { decompile, separator } from "./converter";

const INITIAL_MESSAGE_COUNT = 64;
const LOAD_STEP = 64;
const SCROLL_EDGE_THRESHOLD = 40;

export function Chat(props: {
  messages: Message[],
  dictionary: Map<number, DictEntry>,
  self: number,
  channel: number | null,
  online: Set<number>,
  onSelectSignal: (signal: number) => void,
  onViewImage: (image: Pixel[]) => void,
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_MESSAGE_COUNT);
  const containerRef = useRef<HTMLDivElement>(null);
  const restoreScrollRef = useRef<{ height: number, top: number } | null>(null);
  const pendingBottomRef = useRef(false);

  const filtered = filterChannels(props.messages, props.channel);
  const total = filtered.length;
  const [readCount, setReadCount] = useState(total);
  const unread = total - readCount;
  const recent = filtered.slice(-visibleCount);
  const processed = processEdits(recent);
  const withImages = processImages(processed);
  const withSongs = processSongs(withImages);

  const isScrolling = visibleCount > INITIAL_MESSAGE_COUNT;

  // When more (older) messages are prepended, keep the previously-visible
  // content in place instead of letting the scroll position jump. When the
  // "scroll to bottom" button was clicked, jump straight to the bottom.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (pendingBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      pendingBottomRef.current = false;
      return;
    }
    const restore = restoreScrollRef.current;
    if (restore) {
      el.scrollTop = el.scrollHeight - restore.height + restore.top;
      restoreScrollRef.current = null;
    }
  }, [visibleCount]);

  // Autoscroll to the newest message, but only while no extra history has
  // been lazy-loaded — otherwise a new message would yank the view away
  // from whatever the user scrolled up to read.
  useLayoutEffect(() => {
    if (isScrolling) return;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setReadCount(total);
  }, [total]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollTop <= SCROLL_EDGE_THRESHOLD && visibleCount < total) {
      restoreScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
      setVisibleCount(count => Math.min(count + LOAD_STEP, total));
    } else if (
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_EDGE_THRESHOLD
      && visibleCount > INITIAL_MESSAGE_COUNT
    ) {
      setVisibleCount(INITIAL_MESSAGE_COUNT);
    }
  }

  function handleScrollToBottom() {
    pendingBottomRef.current = true;
    setVisibleCount(INITIAL_MESSAGE_COUNT);
  }

  return <div className="chat-wrap">
    <div
      className="chat"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {withSongs.map((message,i) => <Message key={i}
        message={message}
        dictionary={props.dictionary}
        self={props.self}
        online={props.online}
        onSelectSignal={props.onSelectSignal}
        onViewImage={props.onViewImage}
      />)}
    </div>
    {isScrolling && (
      <button className="scroll-to-bottom" onClick={handleScrollToBottom}>
        ↓ {unread}
      </button>
    )}
  </div>
}

export function Message(props: {
  message: Message,
  dictionary: Map<number, DictEntry>,
  online: Set<number>,
  self: number,
  onSelectSignal: (signal: number) => void,
  onViewImage: (image: Pixel[]) => void,
}): React.ReactNode {
  return <div className={`message
      ${props.message.tags.map(t => `message--${t}`).join(" ")}
      ${props.message.sender === props.self && "message--self"}
  `}>
    <TooltipWrap
      tooltip={new Date(props.message.receivedAt)
        .toLocaleString()}>
      <span className="message-time">{props.message.id.toString().padStart(3, "0")}</span>
    </TooltipWrap>
    <TooltipWrap onClick={() => props.onSelectSignal(props.message.sender)}
      tooltip={props.message.sender}>
      <Sender sender={props.message.sender} dictionary={props.dictionary}/>
    </TooltipWrap>
    <Text
      signals={props.message.signals}
      dictionary={props.dictionary}
      online={props.online}
      onSelectSignal={props.onSelectSignal}
      />
    {props.message.image && <span className="message-button message-viewimage"
      onClick={() => props.onViewImage(props.message.image!)}
    ><span className="material-symbols-outlined">visibility</span></span>}
    {props.message.image && <span className="message-button message-viewimage"
      onClick={() =>
        navigator.clipboard.writeText(decompile(
          imageToSignals(props.message.image!).join(" "),
          props.dictionary,
        ))}
    ><span className="material-symbols-outlined">content_copy</span></span>}
    {props.message.song && <span className="message-button message-playsong"
      onClick={() => playNotes(props.message.song!)}
    ><span className="material-symbols-outlined">play_arrow</span></span>}
    {props.message.song && <span className="message-button message-playsong"
      onClick={() =>
        navigator.clipboard.writeText(decompile(
          songToSignals(props.message.song!).join(" "),
          props.dictionary,
        ))}
    ><span className="material-symbols-outlined">content_copy</span></span>}
  </div>
}

export function Sender(props: {
  sender: number,
  dictionary: Map<number, DictEntry>,
}): React.ReactNode {
  const senderCode = props.sender.toString().padStart(4, "0");
  return <span className="sender"
    onClick={() => playNotes(senderSong(props.sender))}
    style={(() => {
      const code = [...senderCode].map(x => parseInt(x));
      return {
        backgroundColor: `rgb(${code[1]*2*(7-code[0])}, ${code[2]*2*(7-code[0])}, ${code[3]*2*(7-code[0])}`,
        color: `rgb(${code[1]*24+64}, ${code[2]*16+64}, ${code[3]*24+64})`,
      };
    })()}
  >{props.dictionary.get(props.sender)?.def ?? senderCode}</span>
}

export function Text(props: {
  signals: number[],
  dictionary: Map<number, DictEntry>,
  online: Set<number>,
  onSelectSignal: (signal: number) => void,
}): React.ReactNode {
  return <span className="text">
    {props.signals.map((signal, i) => <Fragment key={i}>
      <TooltipWrap onClick={() => {
        const isHuman = signal >= 10 && props.online.has(signal);
        if (!props.dictionary.has(signal) && !isHuman) return;
        props.onSelectSignal(signal);
      }} tooltip={signal}>
        {props.online.has(signal) && signal >= 10 ?
          <Sender sender={signal} dictionary={props.dictionary}/>
        :
          <span className="text-signal">{props.dictionary.get(signal)?.def ?? signal}</span>
        }
      </TooltipWrap>
      {i < props.signals.length && <span>
        {separator(signal, props.signals[i+1], props.dictionary)}
      </span>}
      {i > 0 && signal === props.signals[i-1] && <span>{props.dictionary.get(signal)?.double}</span>}
    </Fragment>
  )}
  </span>;
}