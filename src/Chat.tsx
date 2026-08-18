import { Fragment } from "react/jsx-runtime";
import { filterSecrets, processEdits, type Message } from "./Message";
import type { Ref } from "react";

export function Chat(props: {
  messages: Message[],
  dictionary: Map<number, string>,
  self: number,
  secrets: Set<number>,
  online: Set<number>,
  chatRef: Ref<HTMLDivElement>,
  onSelectSignal: (signal: number) => void,
}) {
  const recent = props.messages.slice(-64);
  const filtered = filterSecrets(recent, props.secrets);
  const processed = processEdits(filtered);

  return <div className="chat" ref={props.chatRef}>
    {processed.map((message) => <Message
      message={message}
      dictionary={props.dictionary}
      self={props.self}
      online={props.online}
      onSelectSignal={() => []}
    />)}
  </div>
}

export function Message(props: {
  message: Message,
  dictionary: Map<number, string>,
  online: Set<number>,
  self: number,
  onSelectSignal: (signal: number) => void,
}): React.ReactNode {
  return <div className={`message
      ${props.message.tags.map(t => `message--${t}`).join(" ")}
      ${props.message.sender === props.self && "message--self"}
  `}>
    <span className="message-time">{props.message.id.toString().padStart(3, "0")}</span>
    <Sender sender={props.message.sender}/>
    <Text
      signals={props.message.signals}
      dictionary={props.dictionary}
      online={props.online}
      onSelectSignal={props.onSelectSignal}
      />
  </div>
}

export function Sender(props: {
  sender: number
}): React.ReactNode {
  const senderCode = props.sender.toString().padStart(4, "0");
  return <span className="sender"
    style={(() => {
      const code = [...senderCode].map(x => parseInt(x));
      return {
        backgroundColor: `rgb(${code[1]*2*(7-code[0])}, ${code[2]*2*(7-code[0])}, ${code[3]*2*(7-code[0])}`,
        color: `rgb(${code[1]*24+64}, ${code[2]*16+64}, ${code[3]*24+64})`,
      };
    })()}
  >{senderCode}</span>
}

export function Text(props: {
  signals: number[],
  dictionary: Map<number, string>,
  online: Set<number>,
  onSelectSignal: (signal: number) => void,
}): React.ReactNode {
  return <span className="text">
    {props.signals.map((signal, i) => <Fragment key={i}>
      <span className="tooltip-wrap" onClick={() => props.onSelectSignal(signal)}>
        {props.online.has(signal) ?
          <Sender sender={signal}/>
        :
          <span className="text-signal">{props.dictionary.get(signal) ?? signal}</span>
        }
        <div className="tooltip">{signal}</div>
      </span>
      {i < props.signals.length && separator(signal, props.signals[i+1])}
    </Fragment>
  )}
  </span>;
}

export function separator(signal1: number, signal2: number) {
  // TODO add more advanced separation rules like in the game
  return <span> </span>;
}