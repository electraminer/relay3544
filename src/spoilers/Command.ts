import type { Message } from "../Message";

type BreakAction = {
  type: "break";
};

type ReplaceAction = {
  type: "replace";
  signals: number[];
};

type SubstituteAction = {
  type: "substitute";
  find: number[];
  replace: number[];
};

type Action = BreakAction | ReplaceAction | SubstituteAction;

interface Command {
  sender: number;
  channel: number | null;
  target?: number;
  action: Action;
}

interface Preposition {
  marker: number | null;
  value: number[] | null;
}

function isPrepMarker(signal: number) {
  return [-40, -41, -85, -86, -121].includes(signal);
}

function getParensAtIndex(
  signals: number[],
  index: number,
): [number[], number] {
  let insideParens: number[] = [];
  while (signals[index] !== -14 || signals[index - 1] === -42) {
    if (signals[index] === -42 && signals[index - 1] === -42) {
      // Signal Signal (escape escape)
      insideParens.push(-42);
    } else if (signals[index] === -42) {
      // Signal (escape)
      const lastSignal = insideParens.pop();
      insideParens.push(-Math.abs(lastSignal ?? -42));
    } else {
      insideParens.push(signals[index]);
    }
    index--;
    if (index < 0) throw new Error("Parens did not end");
  }
  return [insideParens.toReversed(), index - 1];
}

function getIntegerAtIndex(signals: number[], index: number): [number, number] {
  let number = 0;
  let prec = 1;
  while (signals[index] >= 0) {
    number += signals[index] * prec;
    prec *= Math.pow(10, signals[index].toString().length);
    index--;
  }
  return [number, index];
}

function getNumberedObjectAtIndex(
  signals: number[],
  index: number,
): [number[], number] {
  const [number, newIndex] = getIntegerAtIndex(signals, index);

  const object = signals[newIndex];
  if (!object || object === -15 || isPrepMarker(object)) {
    return [[number], newIndex];
  } else {
    return [[object, number], newIndex - 1];
  }
}

function getValueAtIndex(
  signals: number[],
  index: number,
): [number[] | null, number] {
  if (index === -1) {
    return [null, -1];
  } else if (signals[index] === -15) {
    return getParensAtIndex(signals, index - 1);
  } else if (signals[index] < 0) {
    return [[signals[index]], index - 1];
  } else {
    return getNumberedObjectAtIndex(signals, index);
  }
}

function getPrepositionsFromSignals(signals: number[]): Preposition[] {
  const prepositions: Preposition[] = [];
  let index = signals.length - 1;
  while (index >= 0) {
    let marker: number | null = signals[index--];

    if (!isPrepMarker(marker)) {
      index++;
      marker = null;
    }
    const [value, newIndex] = getValueAtIndex(signals, index);
    index = newIndex;
    prepositions.push({ marker, value });
  }

  return prepositions;
}

function getSentenceFromPrepositions(
  prepositions: Preposition[],
  sender: number,
): Map<number | null, number[]> {
  if (prepositions[0]?.marker !== -85) throw new Error("Verb should be last");
  prepositions[prepositions.length - 1].value ??= [sender];
  const sentence = new Map<number | null, number[]>();
  for (const prep of prepositions) {
    if (sentence.has(prep.marker)) throw new Error("Duplicate preposition");
    if (prep.value === null) throw new Error("Null value before end");
    sentence.set(prep.marker, prep.value);
  }
  return sentence;
}

function isHuman(subj: number[], sender: number): boolean {
  if (subj.length === 1 && subj[0] === sender) return true;
  if (subj.length === 2 && subj[0] === -130 && subj[1] === sender) return true;
  return false;
}

function getMessageId(obj: number[]): number {
  if (obj.length === 1 && obj[0] >= 0) return obj[0];
  if (obj.length === 2 && obj[0] === -43 && obj[1] >= 0) return obj[1];
  throw new Error("Object was not a message");
}

function getActionFromSentence(sentence: Map<number | null, number[]>): Action {
  const verb = sentence.get(-85)!;
  if (verb.length === 1 && verb[0] === -88) {
    if (sentence.has(-40)) throw new Error("Cannot break from");
    if (sentence.has(-41)) throw new Error("Cannot break to");
    return { type: "break" };
  } else if (verb.length === 1 && verb[0] === -174) {
    const from = sentence.get(-40);
    const to = sentence.get(-41);
    if (!from) {
      if (to === undefined) throw new Error("Cannot change without from/to");
      return { type: "replace", signals: to };
    } else {
      return { type: "substitute", find: from, replace: to ?? [] };
    }
  }
  throw new Error("Unknown verb");
}

function getCommandFromSentence(
  sentence: Map<number | null, number[]>,
  sender: number,
): Command {
  const subj = sentence.get(-86);
  if (!subj || !isHuman(subj, sender))
    throw new Error("Cannot command on behalf of another");
  const obj = sentence.get(null);
  const target = obj ? getMessageId(obj) : undefined;
  return {
    sender,
    channel: null,
    target,
    action: getActionFromSentence(sentence),
  };
}

function getCommandFromSignals(signals: number[], sender: number): Command {
  getChannel;
  const prepositions = getPrepositionsFromSignals(signals);
  const sentence = getSentenceFromPrepositions(prepositions, sender);
  return getCommandFromSentence(sentence, sender);
}

function stripChannelHeader(signals: number[]): number[] {
  if (signals[0] === -65535) {
    return signals.slice(2);
  } else {
    return signals;
  }
}

function getChannel(signals: number[]): number | null {
  if (signals[0] === -65535) {
    return signals[1] ?? null;
  } else {
    return null;
  }
}

function getCommandFromMessage(message: Message): Command {
  const command = getCommandFromSignals(
    stripChannelHeader(message.signals),
    message.sender,
  );
  command.channel = getChannel(message.signals);
  return command;
}

function editSignalsInChannel(
  signals: number[],
  edit: (signals: number[]) => number[],
): number[] {
  if (signals[0] === -65535) {
    return [...signals.slice(0, 2), ...edit(signals.slice(2))];
  } else {
    return edit(signals);
  }
}

function breakMessage(target: Message, _command: BreakAction) {
  target.tags = [...target.tags, "break"];
  target.signals = editSignalsInChannel(target.signals, (_signals) => {
    return [];
  });
}

function replaceMessage(target: Message, command: ReplaceAction) {
  target.tags = [...target.tags, "replace"];
  target.signals = editSignalsInChannel(target.signals, (_signals) => {
    return command.signals;
  });
}

function substringMatches(
  signals: number[],
  index: number,
  find: number[],
): boolean {
  for (let i = 0; i < find.length; i++) {
    if (signals[i + index] !== find[i]) {
      return false;
    }
  }
  return true;
}

function substitute(
  signals: number[],
  find: number[],
  replace: number[],
): number[] {
  const newSignals = [];
  for (let i = 0; i < signals.length;) {
    if (substringMatches(signals, i, find)) {
      newSignals.push(...replace);
      i += find.length;
    } else {
      newSignals.push(signals[i]);
      i++;
    }
  }
  return newSignals;
}

function substituteInMessage(target: Message, command: SubstituteAction) {
  target.tags = [...target.tags, "substitute"];
  target.signals = editSignalsInChannel(target.signals, (signals) => {
    return substitute(signals, command.find, command.replace);
  });
}

function applyCommandToMessage(target: Message, command: Action) {
  switch (command.type) {
    case "break":
      return breakMessage(target, command);
    case "replace":
      return replaceMessage(target, command);
    case "substitute":
      return substituteInMessage(target, command);
  }
}

function findTarget(
  history: Message[],
  sender: number,
  channel: number | null,
  target?: number,
): Message {
  for (let i = history.length - 2; i >= 0; i--) {
    const message = history[i];
    // Correct sender and channel
    if (
      message.sender === sender &&
      getChannel(message.signals) === channel &&
      // Correct message ID if given
      (message.id === target ||
        // Or any message that is not a command or deleted
        (target === undefined &&
          !message.tags.includes("command") &&
          !message.tags.includes("break")))
    ) {
      return message;
    }
  }
  throw new Error("Target message not found");
}

function applyCommandToHistory(history: Message[], command: Command) {
  const target = findTarget(
    history,
    command.sender,
    command.channel,
    command.target,
  );
  applyCommandToMessage(target, command.action);
}

function markAsCommand(message: Message) {
  message.tags = [...message.tags, "command"];
}

/**
 * Processes message commands like BREAK and CHANGE
 * @param messages The raw messages
 * @returns a new array of processed messages post-edits
 */
export function processCommands(messages: Message[]) {
  const history: Message[] = [];

  for (const message of messages) {
    // Copy the message
    history.push({ ...message });

    try {
      const command = getCommandFromMessage(message);
      applyCommandToHistory(history, command);
      markAsCommand(history.at(-1)!);
    } catch (e) {
      // Not a command or did not have a valid effect, ignore
    }
  }

  return history;
}
