
export class Peekable<V> {
  signals: number[];
  position: number;
  scope: Map<number, V>;

  constructor(signals: number[], position?: number, scope?: Map<number, V>) {
    this.signals = signals;
    this.position = position ?? 0;
    this.scope = scope ?? new Map();
  }

  peek(): number | undefined {
    return this.signals[this.position];
  }

  next(): number | undefined {
    return this.signals[this.position++];
  }

  getVar(key: number): V | undefined {
    return this.scope.get(key);
  }
  
  setVar(key: number, value: V): boolean {
    if (this.scope.has(key)) return false;
    this.scope.set(key, value);
    return true;
  }

  match<T>(filter: (i: Peekable<V>) => T | undefined): T | undefined {
    let prevPosition = this.position;
    let prevScope = new Map(this.scope);
    const result = filter(this);
    if (result === undefined) {
        this.position = prevPosition;
        this.scope = prevScope;
    }
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

export function parseDigitString<V>(i: Peekable<V>): string {
  let number = "";
  let digit;
  while ((digit = i.matchSignal(s => s >= 0)) !== undefined) {
    number += digit.toString();
  }
  return number;
}

export function parseNumber<V>(i: Peekable<V>): number | undefined {
  let number = "";
  if (i.matchExact(-1)) number += "-";
  number += parseDigitString(i);
  if (i.matchExact(-10)) number += ".";
  number += parseDigitString(i);
  return notNan(parseFloat(number));
}

export function parseCollection<T, V>(elem: (i: Peekable<V>) => T | undefined, sep: number, sepRequred: boolean):
    ((i: Peekable<V>) => T[] | undefined) {
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

export function parseGroup<T, V>(contents: (i: Peekable<V>) => T | undefined): ((i: Peekable<V>) => T | undefined) {
  return i => {
    if (!i.matchExact(-14)) return;

    const group = i.match(contents);
    if (!group) return;

    if (!i.matchExact(-15)) return;

    return group;
  }
}