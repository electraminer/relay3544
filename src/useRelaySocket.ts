import { useEffect, useRef, useState } from 'react';
import type { Message } from './Message';
import { codeFromDecimal, codeToDecimal, isValidCode, loadCode, randomCode, saveCode } from './Code';
import { type AudioPlayer } from './AudioPlayer';
import { Song } from './spoilers/Song';
import { getMessageChannel } from './spoilers/Channel';

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
  soundEnabled: boolean,
  setSoundEnabled: (enabled: boolean) => void,
}


export function useRelaySocket(openChannels: number[], audio: AudioPlayer): Relay {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");

  const [online, setOnline] = useState<number[]>([]);

  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    localStorage.getItem("relay-notifications") !== "false"
  );
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem("relay-notifications", String(soundEnabled));
  }, [soundEnabled]);

  const openChannelsRef = useRef(openChannels);
  useEffect(() => {
    openChannelsRef.current = openChannels;
  }, [openChannels]);

  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);


  const [code, setCode] = useState<number>(() => loadCode());
  useEffect(() => {
    saveCode(code);
    socketRef.current?.send(`S,${codeToDecimal(code)}`);
  }, [code]);

  function join(newCode: number) {
    if (!isValidCode(newCode)) throw new Error("Invalid code");
    if (newCode !== code) {
      console.log("join", newCode);
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
          const messageChannel = getMessageChannel(message.signals);
          const channelOpen = messageChannel === null || openChannelsRef.current.includes(messageChannel);
          
          const recentMessages = messages.slice(-10);
          if (recentMessages.find(m =>
            m.id === message.id
            && m.sender === message.sender
            && m.signals.join(" ") === message.signals.join(" "))) return;

          if (soundEnabledRef.current
            && channelOpen
            && audioRef.current.currentSongId === null) {
            audioRef.current.play(Song.senderSong(message.sender));
          }
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
  }, [code]);

  function send(msg: number[]) {
    if (status === "readwrite") {
      const message = `M,${msg.join(",")}`;
      socketRef.current?.send(message);
    }
  }
  
  return {
    code,
    join,
    status,
    online,
    messages,
    send,
    soundEnabled,
    setSoundEnabled,
  };
}
