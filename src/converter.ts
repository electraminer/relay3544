import type { DictEntry } from "./Dictionary";

export class CompileError extends Error {
  readonly start: number;
  readonly end: number;

  constructor(message: string, start: number, end: number) {
    super(message);
    this.name = "CompileError";
    this.start = start;
    this.end = end;
  }
}

export class MultiCompileError extends Error {
  readonly errors: CompileError[];

  constructor(errors: CompileError[]) {
    super(errors.map((e) => e.message).join("; "));
    this.name = "MultiCompileError";
    this.errors = errors;
  }
}

export function tokenize(
  value: string,
  dictionary: Map<number, DictEntry>,
): [number[], number] {
  const signalsAtChar: Record<number, number[] | undefined> = { 0: [] };
  let bestSignals: number[] = [];
  let length = 0;
  for (let i = 0; i <= value.length; i++) {
    const signals = signalsAtChar[i];
    if (!signals) continue;
    bestSignals = signals;
    length = i;

    // Parse numbers
    const match = value.substring(i).match(/^\|?(-?[0-9]+)/);
    if (match !== null) {
      const number = parseFloat(match[1]);
      signalsAtChar[i + match[0].length] ??= [...signals, number];
    }

    if (value.charAt(i) && value.charAt(i).trim() === "") {
      signalsAtChar[i + 1] ??= signals;
    }

    for (const def of dictionary) {
      const [signal, entry] = def;
      const tokens = [entry.def, ...entry.aliases];
      for (const token of tokens) {
        if (
          value.substring(i, i + token.length).toUpperCase() ===
          token.toUpperCase()
        ) {
          signalsAtChar[i + token.length] ??= [...signals, signal];
          break;
        }
      }
    }
  }
  return [bestSignals, length];
}

export function compile(
  value: string,
  dictionary: Map<number, DictEntry>,
): string {
  let [signals, length] = tokenize(value, dictionary);
  if (length < value.length) {
    const errors = [];
    while (length < value.length) {
      let l;
      let start = length;
      do {
        length++;
        [signals, l] = tokenize(value.substring(length), dictionary);
      } while (l === 0 && length < value.length);
      errors.push(
        new CompileError(
          `${value.substring(start, length).trim()} is not a valid token`,
          start,
          length,
        ),
      );
      length += l;
    }
    throw new MultiCompileError(errors);
  }
  return signals.join(" ");
}

export function decompile(
  value: string,
  dictionary: Map<number, DictEntry>,
): string {
  const signals = value.split(/\s\|?/);
  const errors = [];
  let tokens: string = "";
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (signal.trim() === "") continue;
    try {
      const number = parseInt(signal);
      let tokenStr = dictionary.get(number)?.def;
      if (!tokenStr) tokenStr = number.toString();

      tokens += tokenStr;

      // Separator
      if (i < signals.length) {
        tokens += separator(number, parseInt(signals[i + 1]), dictionary);
      }

      // Double Separator
      if (i > 0) {
        tokens += doubleSeparator(parseInt(signals[i - 1]), number, dictionary);
      }
    } catch (e) {
      errors.push(new CompileError(`${signal} is not a number`, 0, 0));
    }
  }
  if (errors.length > 0) {
    throw new MultiCompileError(errors);
  }
  return tokens.trim();
}

export function separator(
  signal1: number,
  signal2: number,
  dictionary: Map<number, DictEntry>,
) {
  let s1 =
    dictionary.get(signal1) ??
    dictionary.get(signal1 < 0 ? -Infinity : Infinity)!;
  let s2 =
    dictionary.get(signal2) ??
    dictionary.get(signal2 < 0 ? -Infinity : Infinity)!;
  let sep = s1.after + s2.before;
  if (s1.after === s2.before) sep = s1.after;
  if (sep.includes("\n")) return sep.replace(" ", "");
  return sep;
}

export function doubleSeparator(
  signal1: number,
  signal2: number,
  dictionary: Map<number, DictEntry>,
) {
  if (signal1 !== signal2) return "";
  let s2 =
    dictionary.get(signal2) ??
    dictionary.get(signal2 < 0 ? -Infinity : Infinity)!;
  return s2.double;
}
