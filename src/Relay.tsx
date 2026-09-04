import { useEffect, useRef, useState, type ReactNode } from "react";
import { compile, decompile, type PositionedSignal } from "./converter";
import "./Relay.css";
import { Chat, usernameStyle } from "./Chat";
import type { Image } from "./spoilers/Image";
import { entryStyle, type DictEntry } from "./Dictionary";
import type { Relay, useRelaySocket } from "./useRelaySocket";
import type { AudioPlayer } from "./AudioPlayer";

function renderHighlighted(
  value: string,
  tokens: PositionedSignal[],
  dictionary: Map<number, DictEntry>,
  online: Set<number>,
): ReactNode {
  // The highlight fill is passed as `--mark-bg` rather than `background`, so
  // Relay.css can paint it as a line-box-sized band instead of a full
  // font-metrics box (which is taller than line-height, making the fills of
  // wrapped or stacked highlights overlap).
  function textSignalStyle(signal: number | null): object {
    if (signal === null)
      return {
        color: "#ff5555",
        "--mark-bg": "rgba(255, 85, 85, 0.25)",
      };
    if (!dictionary.has(signal)) {
      signal = signal < 0 ? -Infinity : Infinity;
    }
    const { backgroundColor, ...rest } = entryStyle(dictionary.get(signal)!);
    return { ...rest, "--mark-bg": backgroundColor };
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((tok, i) => {
    if (cursor < tok.start)
      parts.push(<span>{value.slice(cursor, tok.start)}</span>);
    parts.push(
      <mark
        key={i}
        className={`mark--parity-${i % 2}`}
        style={
          online.has(tok.signal ?? -1)
            ? usernameStyle(tok.signal ?? -1)
            : textSignalStyle(tok.signal)
        }
      >
        {value.slice(tok.start, tok.end)}
      </mark>,
    );
    cursor = Math.max(cursor, tok.end);
  });
  if (cursor < value.length)
    parts.push(<span>{value.slice(cursor) + " "}</span>);
  return parts;
}

export function EditorPane(props: {
  dictionary: Map<number, DictEntry>;
  onSend: (msg: number[]) => void;
  status: string;
  online: Set<number>;
}) {
  const { dictionary, onSend, status } = props;

  const [value, setValue] = useState("");
  const [compiled, setCompiled] = useState<PositionedSignal[]>([]);
  const [importError, setImportError] = useState<string>("");
  const [importSuccess, setImportSuccess] = useState<string>("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const errors = compiled.filter((x) => x.signal === null);

  function syncScroll() {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  function handleChange(next: string) {
    setValue(next);
    setImportError("");
    setImportSuccess("");
    setCompiled(compile(next, dictionary));
  }

  useEffect(() => {
    handleChange(value);
  }, [dictionary]);

  async function handleImport() {
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      setImportError("Could not read clipboard");
      setImportSuccess("");
      return;
    }

    try {
      const compiled = compile(clipboardText, dictionary);
      const compStr = compiled.map((x) => x.signal).join(" ");
      const next = decompile(compStr, dictionary);
      handleChange(next);
      setImportError("");
      setImportSuccess("Imported!");
    } catch (e) {
      setImportError(String(e));
    }
  }

  async function handleExport() {
    try {
      await navigator.clipboard.writeText(
        compiled.map((x) => x.signal).join(" "),
      );
      setImportError("");
      setImportSuccess("Exported!");
    } catch {
      setImportError("Could not write to clipboard");
      setImportSuccess("");
    }
  }

  function handleSend() {
    if (errors.length > 0 || compiled.length === 0) return;
    // This ! is okay because we just verified that errors is empty
    onSend(compiled.map((x) => x.signal!));
    handleChange("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (status === "readwrite") {
        e.preventDefault();
        handleSend();
      }
    }
  }

  return (
    <div className="editor">
      <div className="toolbar">
        <button onClick={handleImport} disabled={status !== "readwrite"}>
          →Import
        </button>
        <button
          disabled={errors.length > 0 || status !== "readwrite"}
          onClick={handleExport}
        >
          Export→
        </button>
        <button
          disabled={
            errors.length > 0 || compiled.length === 0 || status !== "readwrite"
          }
          onClick={handleSend}
        >
          Send↑
        </button>
      </div>
      <div className="field">
        <div className="textbox">
          <div className="backdrop" ref={backdropRef}>
            <div className="highlights">
              {renderHighlighted(value, compiled, dictionary, props.online)}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            spellCheck={false}
            autoComplete="off"
            className={errors.length > 0 ? "invalid" : ""}
            value={
              status === "readwrite"
                ? value
                : status === "readonly"
                  ? "Call sign already in use"
                  : "Connecting"
            }
            onChange={(e) => handleChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            disabled={status !== "readwrite"}
          />
        </div>
        {importError.length > 0 && (
          <div className="importerr-bar">
            <div>{importError}</div>
          </div>
        )}
        {importSuccess && (
          <div className="importsucc-bar">
            <div>{importSuccess}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatViewer(props: {
  dictionary: Map<number, DictEntry>;
  onImage: (image: Image) => void;
  onDefine: (signal: number) => void;
  relay: ReturnType<typeof useRelaySocket>;
  channel: number | null;
  audio: AudioPlayer;
}) {
  const { dictionary, onImage, onDefine, relay } = props;
  const { code, online, messages } = relay;

  return (
    <div className="chat-viewer">
      <div className="field">
        <Chat
          messages={messages}
          self={code ?? 0}
          channel={props.channel}
          dictionary={dictionary}
          online={new Set(online)}
          onSelectSignal={onDefine}
          onViewImage={onImage}
          audio={props.audio}
        />
      </div>
    </div>
  );
}

export function RelayPane(props: {
  dictionary: Map<number, DictEntry>;
  onImage: (image: Image) => void;
  onDefine: (signal: number) => void;
  onSend: (message: number[], channel: number | null) => void;
  relay: Relay;
  channel: number | null;
  audio: AudioPlayer;
}) {
  return (
    <div className="relay">
      <ChatViewer
        dictionary={props.dictionary}
        onImage={props.onImage}
        onDefine={props.onDefine}
        relay={props.relay}
        channel={props.channel}
        audio={props.audio}
      />
      <EditorPane
        dictionary={props.dictionary}
        onSend={(msg) => props.onSend(msg, props.channel)}
        status={props.relay.status}
        online={new Set(props.relay.online)}
      />
    </div>
  );
}
