
export class Peekable {
  signals: number[];
  position: number;

  constructor(signals: number[], position?: number) {
    this.signals = signals;
    this.position = position ?? 0;
  }

  peek(): number | undefined {
    return this.signals[this.position];
  }

  next(): number | undefined {
    return this.signals[this.position++];
  }

  match<T>(filter: (i: Peekable) => T | undefined): T | undefined {
    let prevPosition = this.position;
    const result = filter(this);
    if (result === undefined) this.position = prevPosition;
    return result;
  }

  matchSignal(filter: (signal: number) => boolean): number | undefined {
    if (this.peek() !== undefined && filter(this.peek()!)) {
      return this.next();
    }
  }

  matchExact(signal?: number): boolean {
    return this.matchSignal(s => s === signal) !== undefined;
  }
}

function notNan(number: number): number | undefined {
  return Number.isNaN(number) ? undefined : number;
}

export function parseDigitString(i: Peekable): string {
  let number = "";
  let digit;
  while ((digit = i.matchSignal(s => s >= 0)) !== undefined) {
    number += digit.toString();
  }
  return number;
}

export function parseNumber(i: Peekable): number | undefined {
  let number = "";
  if (i.matchExact(-1)) number += "-";
  number += parseDigitString(i);
  if (i.matchExact(-10)) number += ".";
  number += parseDigitString(i);
  return notNan(parseFloat(number));
}

export function parseCollection<T>(elem: (i: Peekable) => T | undefined, sep: number, sepRequred: boolean):
    ((i: Peekable) => T[] | undefined) {
  return i => {
    const collection = [];
    while (true) {
      const item = i.match(elem);
      if (!item) return collection;
      collection.push(item);
      
      if (!i.matchExact(sep) && sepRequred) return collection;
    }
  }
}

export function parseGroup<T>(contents: (i: Peekable) => T | undefined): ((i: Peekable) => T | undefined) {
  return i => {
    if (!i.matchExact(-14)) return;

    const group = i.match(contents);
    if (!group) return;

    if (!i.matchExact(-15)) return;

    return group;
  }
}