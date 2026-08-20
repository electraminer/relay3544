import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  compile,
  decompile,
  CompileError,
  MultiCompileError,
} from './converter';
import './App.css';
import { Chat, Sender } from './Chat';
import type { Message } from './Message';
import { Image, type Pixel } from './Image';
import { Dictionary, type DictEntry } from './Dictionary';

function renderHighlighted(value: string, errors: CompileError[]): ReactNode {
  const ranges = errors.filter((e) => e.end > e.start).sort((a, b) => a.start - b.start);
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

function Editor({ dictionary, onSend }: { dictionary: Map<number, DictEntry>, onSend: (msg: string) => void}) {
  const [value, setValue] = useState('');
  const [compiled, setCompiled] = useState('');
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
      setCompileErrors(e instanceof MultiCompileError ? e.errors : [e as CompileError]);
    }
  }

  useEffect(() => {
    handleChange(value);
  }, [dictionary])

  async function handleImport() {
    let clipboardText: string;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch {
      setImportErrors([new CompileError('Could not read clipboard', 0, 0)]);
      setImportSuccess([]);
      return;
    }

    try {
      const compiled = compile(clipboardText, dictionary);
      const next = decompile(compiled, dictionary);
      handleChange(next);
      setImportErrors([]);
      setImportSuccess([new CompileError('Imported!', 0, 0)]);
    } catch (e) {
      setImportErrors(e instanceof MultiCompileError ? e.errors : [e as CompileError]);
    }
  }

  async function handleExport() {
    try {
      await navigator.clipboard.writeText(compiled);
      setImportErrors([]);
      setImportSuccess([new CompileError('Exported!', 0, 0)]);
    } catch {
      setImportErrors([new CompileError('Could not write to clipboard', 0, 0)]);
      setImportSuccess([]);
    }
  }

  function handleSend() {
    if (compileErrors.length > 0 || compiled.length === 0) return;
    onSend(compiled);
    handleChange("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="editor">
      <div className="toolbar">
        <button onClick={handleImport}>→Import</button>
        <button disabled={compileErrors.length > 0} onClick={handleExport}>
          Export→
        </button>
        <button disabled={compileErrors.length > 0 || compiled.length === 0} onClick={handleSend}>
          Send↑
        </button>
      </div>
      <div className="field">
        <div className="textbox">
          <div className="backdrop" ref={backdropRef}>
            <div className="highlights">{renderHighlighted(value, compileErrors)}</div>
          </div>
          <textarea
            ref={textareaRef}
            spellCheck={false}
            autoComplete="off"
            className={compileErrors.length > 0 ? 'invalid' : ''}
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

const SOCKET_URL = 'wss://dscr-relay.dixonary.co.uk/';
const CODE_STORAGE_KEY = 'message-compiler-socket-code';
const DEFAULT_CODE = new Array(4).fill(0).map(_ => Math.floor(Math.random() * 8)).join("");
const MESSAGES_STORAGE_KEY = 'relay-messages';
const SECRETS_STORAGE_KEY = 'relay-secrets';

type SocketStatus = 'connecting' | 'open' | 'closed';

function isOctalCode(text: string): boolean {
  return /^[0-7]{0,4}$/.test(text);
}

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed) return [];
    return parsed;
  } catch (e) {
    console.log("load error", e);
    return [];
  }
}

function loadSecrets(): Set<number> {
  try {
    const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed);
  } catch (e) {
    console.log("load error", e);
    return new Set();
  }
}

function loadCode(): string {
  try {
    const raw = localStorage.getItem(CODE_STORAGE_KEY);
    if (raw && isOctalCode(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_CODE;
}

function handshakeFor(code: string): string | null {
  if (code.length !== 4) return null;
  return `S,${parseInt(code, 8)}`;
}

function SocketOutput({dictionary, setOnSend, onImage, onDefine}:
  {dictionary: Map<number, DictEntry>
     setOnSend: (onSend: (msg: string) => void) => void,
     onImage: (image: Pixel[]) => void,
    onDefine: (signal: number) => void,
  }) {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [code, setCode] = useState<string>(loadCode);
  const [connectedCode, setConnectedCode] = useState<number | null>(null);
  const [secrets, setSecrets] = useState<Set<number>>(loadSecrets);
  const socketRef = useRef<WebSocket | null>(null);

  const [online, setOnline] = useState<number[]>([]);

  useEffect(() => {
    const ws = new WebSocket(SOCKET_URL);
    socketRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      setStatus('open');
      const handshake = handshakeFor(loadCode());
      if (handshake) ws.send(handshake);
    };
    ws.onclose = () => setStatus('closed');
    ws.onerror = () => setStatus('closed');
    ws.onmessage = (event) => {
      const [type, ...params] = (event.data as string).split(",");
      const numbers = params.map(x => parseInt(x));
      if (type === "U") {
        setConnectedCode(null);
      }
      if (type === "K") {
        setConnectedCode(parseInt(numbers[0].toString(8)));
      }
      if (type === "C") {
        setOnline(numbers.map(x => parseInt(x.toString(8))));
      }
      if (type === "R") {
        const message: Message = {
          id: numbers[1],
          sender: parseInt(numbers[0].toString(8)),
          signals: numbers.slice(2),
          receivedAt: Date.now(),
          tags: [],
        };
        const recentMessages = messages.slice(-10);
        if (recentMessages.find(m =>
          m.id === message.id
          && m.sender === message.sender
          && m.signals.join(" ") === message.signals.join(" "))) return;
        setMessages(m => [...m, message]);
      }
    };

    setOnSend(msg => {
      const signals = msg.split(" ").map((x: string) => parseInt(x));
      // Locally processed commands
      if (signals.length === 2 && signals[0] === -65533) {
        setSecrets(secrets => new Set([...secrets].filter(x => x !== signals[1])));
        return;
      } else if (signals.length === 2 && signals[0] === -65534) {
        setSecrets(secrets => new Set([...secrets, signals[1]]));
        return;
      }
      // Send
      const message = `M,${msg.replaceAll(" ",",")}`;
      ws.send(message);
    })

    return () => {
      socketRef.current = null;
      ws.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify([...secrets]));
  }, [secrets]);

  useEffect(() => {
    if (!isOctalCode(code)) return;
    setCode(code);
    localStorage.setItem(CODE_STORAGE_KEY, code);
  }, [code]);

  function handleSend() {
    const ws = socketRef.current;
    const handshake = handshakeFor(code);
    if (!ws || ws.readyState !== WebSocket.OPEN || !handshake) return;
    ws.send(handshake);
  }

  return (
    <div className="editor msgeditor">
      <div className="output-controls">
        <input
          className="output-code"
          placeholder="0000"
          inputMode="numeric"
          spellCheck={false}
          autoComplete="off"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="tooltip-wrap headbutton">
          <button
            disabled={status !== 'open' || code.length !== 4}
            onClick={handleSend}
          >
            {parseInt(code) === connectedCode ? `${online.length} online` : `connect`}
          </button>
          <div className="tooltip">
            <div className="tooltip-title">Online</div>
            {online.length > 0 ? (
              online.map((id, i) =>
                <div className="tooltip-line"><Sender sender={id} key={i}/></div>
              )
            ) : (
              <div className="tooltip-empty">No one online</div>
            )}
          </div>
        </div>
        <div className="tooltip-wrap headbutton">
          <button disabled>
            {secrets.size === 1 ? "1 secret" : `${secrets.size} secrets`}
          </button>
          <div className="tooltip">
            <div className="tooltip-title">Secrets</div>
            {secrets.size > 0 ? (
              [...secrets].map((id, i) =>
                <span key={i} className="tooltip-line"
                >{decompile(`${id}`, dictionary)}</span>
              )
            ) : (
              <div className="tooltip-empty">No secrets</div>
            )}
          </div>
        </div>
      </div>
      <div className="field">
        <Chat
          messages={messages}
          self={connectedCode ?? 0}
          secrets={secrets}
          dictionary={dictionary}
          online={new Set(online)}
          onSelectSignal={onDefine}
          onViewImage={onImage}
          />
      </div>
    </div>
  );
}

function App() {
  const [image, setImage] = useState<Pixel[]>([]);

  const [dictMap, setDict] = useState<Map<number, DictEntry>>(new Map());
  const [onDefine, setOnDefine] = useState<(signal: number) => void>(() => {});

  const [onSend, setOnSend] = useState<(msg: string) => void>(() => {});
  return (
    <div className="app">
      <Dictionary onChangeDict={setDict} setOnDefine={onDefine => setOnDefine(() => onDefine)}/>
      <div className="relay">
        <SocketOutput
          dictionary={dictMap} setOnSend={onSend => setOnSend(() => onSend)}
          onImage={setImage} onDefine={onDefine}/>
        <Editor dictionary={dictMap} onSend={onSend}/>
      </div>
      <Image image={image} dictionary={dictMap} />
    </div>
  );
}

export default App;
