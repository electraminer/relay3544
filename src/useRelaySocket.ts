import { useEffect, useRef, useState } from 'react';
import type { Message } from './Message';
import { codeFromDecimal, codeToDecimal, isValidCode, loadCode, randomCode, saveCode } from './Code';

const SOCKET_URL = 'wss://dscr-relay.dixonary.co.uk/';
const MESSAGES_STORAGE_KEY = 'relay-messages';

export type SocketStatus = "connecting" | "joining" | "readwrite" | "readonly";

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

export interface Relay {
  code: number,
  join: (code: number) => void,
  status: SocketStatus,
  online: number[],
  messages: Message[],
  send: (msg: number[]) => void,
}


export function useRelaySocket(): Relay {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");

  const [online, setOnline] = useState<number[]>([]);
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  useEffect(() => {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);


  const [code, setCode] = useState<number>(() => loadCode());
  useEffect(() => {
    saveCode(code);
    console.log(socketRef.current);
    socketRef.current?.send(`S,${codeToDecimal(code)}`);
  }, [code]);

  function join(newCode: number) {
    if (!isValidCode(newCode)) throw new Error("Invalid code");
    if (newCode !== code) {
      setCode(newCode);
    }
  }

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let retryTimeout: number | undefined;

    function connect() {
      const ws = new WebSocket(SOCKET_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setStatus("joining");
        socketRef.current?.send(`S,${codeToDecimal(code)}`);
      };
      ws.onclose = () => {
        setStatus("connecting");
        if (stopped) return;
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        attempt++;
        retryTimeout = setTimeout(connect, delay);
      };
      ws.onerror = () => setStatus("connecting");
      ws.onmessage = (event) => {
        const [type, ...params] = (event.data as string).split(",");
        const numbers = params.map(x => parseInt(x));
        if (type === "U") {
          // Blocked, but try connecting with a random code (readonly)
          setStatus("readonly");
          socketRef.current?.send(`S,${codeToDecimal(randomCode())}`);
        }
        if (type === "K") {
          // Connection success!
          if (numbers[0] === codeToDecimal(code)) {
            setStatus("readwrite");
          }
        }
        if (type === "C") {
          setOnline(numbers.map(codeFromDecimal));
          if (!numbers.includes(codeToDecimal(code))) {
            socketRef.current?.send(`S,${codeToDecimal(code)}`);
          }
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
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimeout);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  function send(msg: number[]) {
    if (status === "readwrite") {
      const message = `M,${msg.join(",")}`;
      socketRef.current?.send(message);
    }
  }

  console.log(status);

  return {
    code,
    join,
    status,
    online,
    messages,
    send,
  };
}
