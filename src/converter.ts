import type { DictEntry } from "./Dictionary";

export interface PositionedSignal {
  signal: number | null;
  start: number;
  end: number;
}

export function tokenize(
  value: string,
  startIdx: number,
  dictionary: Map<number, DictEntry>,
): PositionedSignal[] {
  const signalsAtChar: Record<number, PositionedSignal[] | undefined> = {
    [startIdx]: [],
  };
  let bestSignals: PositionedSignal[] = [];
  for (let i = startIdx; i <= value.length; i++) {
    const signals = signalsAtChar[i];
    if (!signals) continue;
    bestSignals = signals;

    // Parse numbers
    const match = value.substring(i).match(/^\|?(-?[0-9]+)/);
    if (match !== null) {
      const signal = parseFloat(match[1]);
      signalsAtChar[i + match[0].length] ??= [
        ...signals,
        {
          signal,
          start: i,
          end: i + match[0].length,
        },
      ];
    }

    if (value.charAt(i) && value.charAt(i).trim() === "") {
      signalsAtChar[i + 1] ??= signals;
    }

    const lowestAliasesByLength = new Map<number, number>();
    for (const def of dictionary) {
      const [signal, entry] = def;
      if (!Number.isFinite(signal)) continue;
      const tokens = [entry.def, ...entry.aliases];
      for (const token of tokens) {
        if (
          value.substring(i, i + token.length).toUpperCase() ===
          token.toUpperCase()
        ) {
          // If multiple things match, pick based on the one with fewer aliases
          // (to allow aliases to be an alternative for referincing duplicates)
          const prevLowest =
            lowestAliasesByLength.get(token.length) ?? Infinity;
          if (tokens.length < prevLowest) {
            lowestAliasesByLength.set(token.length, tokens.length);
            signalsAtChar[i + token.length] ??= [
              ...signals,
              {
                signal,
                start: i,
                end: i + token.length,
              },
            ];
          }
        }
      }
    }
  }
  return bestSignals;
}

export function compile(
  value: string,
  dictionary: Map<number, DictEntry>,
): PositionedSignal[] {
  let signals = [];
  let index = 0;
  while (true) {
    if (index >= value.length) return signals;
    if (value.charAt(index).trim().length === 0) {
      index++;
      continue;
    }

    signals.push(...tokenize(value, index, dictionary));
    const nextIndex = signals.at(-1)?.end ?? 0;
    if (nextIndex <= index) {
      const prevError = signals.at(-1);
      if (prevError && prevError.signal === null && prevError.end === index) {
        prevError.end++;
      } else {
        signals.push({ signal: null, start: index, end: index + 1 });
      }
      index++;
    } else {
      index = nextIndex;
    }
  }
}

export function decompile(
  value: string,
  dictionary: Map<number, DictEntry>,
): string {
  const signals = value.split(/\s\|?/);
  let tokens: string = "";
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    if (signal.trim() === "") continue;
    const number = parseInt(signal);
    if (Number.isNaN(number)) throw new Error(`${signal} is not a number`);
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
