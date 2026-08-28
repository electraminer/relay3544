import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  compile,
  decompile,
  CompileError,
  MultiCompileError,
} from "./converter";
import "./Relay.css";
import { Chat } from "./Chat";
import type { Image } from "./spoilers/Image";
import type { DictEntry } from "./Dictionary";
import type { Relay, useRelaySocket } from "./useRelaySocket";
import type { AudioPlayer } from "./AudioPlayer";

function renderHighlighted(value: string, errors: CompileError[]): ReactNode {
  const ranges = errors
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start - b.start);
  if (ranges.length === 0) return value;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((err, i) => {
    if (err.start > cursor) parts.push(value.slice(cursor, err.start));
    parts.push(<mark key={i}>{value.slice(err.start, err.end)}</mark>);
    cursor = Math.max(cursor, err.end);
  });
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function EditorPane(props: {
  dictionary: Map<number, DictEntry>;
  onSend: (msg: number[]) => void;
  canSend: boolean;
}) {
  const { dictionary, onSend, canSend } = props;

  const [value, setValue] = useState("");
  const [compiled, setCompiled] = useState("");
  const [importErrors, setImportErrors] = useState<CompileError[]>([]);
  const [importSuccess, setImportSuccess] = useState<CompileError[]>([]);
  const [compileErrors, setCompileErrors] = useState<CompileError[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function syncScroll() {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  function handleChange(next: string) {
    setValue(next);
    setImportErrors([]);
    setImportSuccess([]);
    setCompileErrors([]);
    try {
      setCompiled(compile(next, dictionary));
    } catch (e) {
      setCompileErrors(
        e instanceof MultiCompileError ? e.errors : [e as CompileError],
      );
    }
  }

  useEffect(() => {
    handleChange(value);
  }, [dictionary]);

  async function handleImport() {
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      setImportErrors([new CompileError("Could not read clipboard", 0, 0)]);
      setImportSuccess([]);
      return;
    }

    try {
      const compiled = compile(clipboardText, dictionary);
      const next = decompile(compiled, dictionary);
      handleChange(next);
      setImportErrors([]);
      setImportSuccess([new CompileError("Imported!", 0, 0)]);
    } catch (e) {
      setImportErrors(
        e instanceof MultiCompileError ? e.errors : [e as CompileError],
      );
    }
  }

  async function handleExport() {
    try {
      await navigator.clipboard.writeText(compiled);
      setImportErrors([]);
      setImportSuccess([new CompileError("Exported!", 0, 0)]);
    } catch {
      setImportErrors([new CompileError("Could not write to clipboard", 0, 0)]);
      setImportSuccess([]);
    }
  }

  function handleSend() {
    if (compileErrors.length > 0 || compiled.length === 0) return;
    onSend(compiled.split(" ").map((x) => parseInt(x)));
    handleChange("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      if (canSend) {
        e.preventDefault();
        handleSend();
      }
    }
  }

  return (
    <div className="editor">
      <div className="toolbar">
        <button onClick={handleImport}>→Import</button>
        <button disabled={compileErrors.length > 0} onClick={handleExport}>
          Export→
        </button>
        <button
          disabled={
            compileErrors.length > 0 || compiled.length === 0 || !canSend
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
              {renderHighlighted(value, compileErrors)}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            spellCheck={false}
            autoComplete="off"
            className={compileErrors.length > 0 ? "invalid" : ""}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
          />
        </div>
        {importErrors.length > 0 && (
          <div className="importerr-bar">
            {importErrors.map((err, i) => (
              <div key={i}>{err.message}</div>
            ))}
          </div>
        )}
        {importSuccess.length > 0 && (
          <div className="importsucc-bar">
            {importSuccess.map((err, i) => (
              <div key={i}>{err.message}</div>
            ))}
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
        canSend={props.relay.status === "readwrite"}
      />
    </div>
  );
}
