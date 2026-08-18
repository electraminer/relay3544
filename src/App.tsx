import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  compile,
  decompile,
  CompileError,
  MultiCompileError,
  DEFAULT_DICTIONARY,
  type Dictionary,
  type DictionaryEntry,
} from './converter';
import './App.css';
import { Chat, Sender } from './Chat';
import type { Message } from './Message';

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

interface DictRow {
  id: number;
  signal: string;
  token: string;
}

let nextRowId = 0;

const STORAGE_KEY = 'message-compiler-dictionary';

function seedRows(): DictRow[] {
  return DEFAULT_DICTIONARY.map(([signal, token]) => ({ id: nextRowId++, signal: String(signal), token }));
}

function loadRows(): DictRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedRows();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedRows();

    return parsed.map((row) => ({
      id: nextRowId++,
      signal: typeof row?.signal === 'string' ? row.signal : '',
      token: typeof row?.token === 'string' ? row.token : '',
    }));
  } catch {
    return seedRows();
  }
}

function toDictionary(rows: DictRow[]): Dictionary {
  const entries: DictionaryEntry[] = [];
  for (const row of rows) {
    const signal = Number(row.signal);
    if (row.token === '' || !Number.isFinite(signal)) continue;
    entries.push([signal, row.token]);
  }
  return entries;
}

function sortRows(rows: DictRow[]): DictRow[] {
  return [...rows].sort((a, b) => {
    const an = Number(a.signal);
    const bn = Number(b.signal);
    const aValid = a.signal !== '' && Number.isFinite(an);
    const bValid = b.signal !== '' && Number.isFinite(bn);
    if (aValid && bValid) return bn - an;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
}

function DictionaryPanel({ rows, onChange }: { rows: DictRow[]; onChange: (rows: DictRow[]) => void }) {
  function updateRow(id: number, field: 'signal' | 'token', text: string) {
    onChange(rows.map((row, i) => (i === id ? { ...row, [field]: text } : row)));
  }

  function removeRow(id: number) {
    onChange(rows.filter((_, i) => i !== id));
  }

  function addRow() {
    onChange([...rows, { id: nextRowId++, signal: '', token: '' }]);
  }

  return (
    <div className="dictionary">
      <div className="toolbar">
        <button onClick={addRow}>+ Add</button>
        <button onClick={() => onChange(sortRows(rows))}>Sort</button>
      </div>
      <div className="dictionary-rows">
        {rows.map((row, i) => (
          <div className="dictionary-row" key={i}>
            <input
              className="dictionary-signal"
              placeholder="signal"
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              value={row.signal}
              onChange={(e) => updateRow(i, 'signal', e.target.value)}
            />
            <input
              className="dictionary-token"
              placeholder="token"
              spellCheck={false}
              autoComplete="off"
              value={row.token}
              onChange={(e) => updateRow(i, 'token', e.target.value)}
            />
            <button className="dictionary-remove" onClick={() => removeRow(i)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Editor({ dictionary, onSend }: { dictionary: Map<number, string>, onSend: (msg: string) => void}) {
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
      const next = decompile(clipboardText, dictionary);
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
        {compileErrors.length > 0 && (
          <div className="error-bar">
            {compileErrors.map((err, i) => (
              <div key={i}>{err.message}</div>
            ))}
          </div>
        )}
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
const DEFAULT_CODE = '3544';
const MESSAGES_STORAGE_KEY = 'relay-messages';

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

function SocketOutput({dictionary, setOnSend}: {dictionary: Map<number, string>, setOnSend: (onSend: (msg: string) => void) => void}) {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [code, setCode] = useState<string>(loadCode);
  const [connectedCode, setConnectedCode] = useState<number | null>(null);
  const [secrets, setSecrets] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
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
      console.log("SENDING", msg.replaceAll(" ",","));
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
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleCodeChange(next: string) {
    if (!isOctalCode(next)) return;
    setCode(next);
    localStorage.setItem(CODE_STORAGE_KEY, next);
  }

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
          onChange={(e) => handleCodeChange(e.target.value)}
        />
        <div className="tooltip-wrap headbutton">
          <button
            disabled={status !== 'open' || code.length !== 4 || parseInt(code) === connectedCode}
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
          onSelectSignal={() => []}
          chatRef={listRef}
          />
      </div>
    </div>
  );
}

function App() {
  const [rows, setRows] = useState<DictRow[]>(loadRows);
  const dictionary = useMemo(() => toDictionary(rows), [rows]);

  const dictMap = new Map<number, string>();
  for (const entry of dictionary) {
    dictMap.set(entry[0], entry[1]);
  }

  useEffect(() => {
    const stored = rows.map(({ signal, token }) => ({ signal, token }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [rows]);

  const [onSend, setOnSend] = useState<(msg: string) => void>(() => {});

  return (
    <div className="app">
      <DictionaryPanel rows={rows} onChange={setRows} />
      <div className="relay">
        <SocketOutput dictionary={dictMap} setOnSend={onSend => setOnSend(() => onSend)}/>
        <Editor dictionary={dictMap} onSend={onSend}/>
      </div>
    </div>
  );
}

export default App;
