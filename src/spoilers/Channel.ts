import type { Message } from "../Message";

export function getMessageChannel(signals: number[]): number | null {
  return signals[0] === -65535 ? signals[1] : null;
}

export type ChannelCommand = { type: "join" | "leave"; channel: number };

export function getChannelCommand(signals: number[]): ChannelCommand | null {
  if (signals[0] === -65534 && signals.length === 2) {
    return { type: "join", channel: signals[1] };
  }
  if (signals[0] === -65533 && signals.length === 2) {
    return { type: "leave", channel: signals[1] };
  }
  return null;
}

export function sentInsideChannel(
  signals: number[],
  channel: number | null,
): number[] {
  if (channel === null || channel === -65536) return signals;
  return [-65535, channel, ...signals];
}

export function displayedInsideChannel(
  signals: number[],
  channel: number | null,
): number[] {
  if (channel === null || channel === -65536) return signals;
  return signals.slice(2);
}

export function filterByChannel(channel: number | null) {
  return (m: Message): boolean =>
    (m.signals[0] !== -65535 && channel === null) ||
    (m.signals[0] === -65535 && channel === m.signals[1]) ||
    channel === -65536;
}

export function processChannel(messages: Message[], channel: number | null) {
  return messages.map((m) =>
    channel !== -65536 || m.signals[0] !== -65535
      ? m
      : {
          ...m,
          tags: [...m.tags, "secret"],
        },
  );
}

export const NULL_CHANNEL_NAME: number[] = [-111, -65535];
