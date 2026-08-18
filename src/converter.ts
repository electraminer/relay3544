export class CompileError extends Error {
  readonly start: number;
  readonly end: number;

  constructor(message: string, start: number, end: number) {
    super(message);
    this.name = 'CompileError';
    this.start = start;
    this.end = end;
  }
}

export class MultiCompileError extends Error {
  readonly errors: CompileError[];

  constructor(errors: CompileError[]) {
    super(errors.map((e) => e.message).join('; '));
    this.name = 'MultiCompileError';
    this.errors = errors;
  }
}

export type DictionaryEntry = [number, string];
export type Dictionary = DictionaryEntry[];

export const DEFAULT_DICTIONARY: Dictionary = [

]

export function tokenize(value: string, dictionary: Map<number, string>): [number[], number] {
  const signalsAtChar: Record<number, number[] | undefined> = {0: []};
  let bestSignals: number[] = [];
  let length = 0;
  for (let i = 0; i <= value.length; i++) {
    const signals = signalsAtChar[i];
    if (!signals) continue;
    bestSignals = signals;
    length = i; 
    
    // Parse numbers
    const matchNum = value.substring(i).match(/^(-?[0-9]+)/)?.[0];
    if (matchNum !== undefined) {
      const number = parseFloat(matchNum);
      signalsAtChar[i + matchNum.length] ??= [...signals, number];
    }
    
    if (value.charAt(i) && value.charAt(i).trim() === "") {
      signalsAtChar[i + 1] ??= signals;
    }

    for (const def of dictionary) {
      const [signal, token] = def;
      if (value.substring(i, i + token.length).toUpperCase() === token.toUpperCase()) {
        signalsAtChar[i + token.length] ??= [...signals, signal];
      }
    }
  }
  return [bestSignals, length];
}

function compileUncached(value: string, dictionary: Map<number, string>): string {
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
      errors.push(new CompileError(`${value.substring(start, length).trim()} is not a valid token`, start, length));
      length += l;
    }
    throw new MultiCompileError(errors);
  }
  return signals.join(" ");
}

function memoize<T extends WeakKey>(fn: (value: string, dictionary: T) => string) {
  const results = new WeakMap<T, Map<string, string>>();
  const failures = new WeakMap<T, Map<string, CompileError | MultiCompileError>>();

  return (value: string, dictionary: T): string => {
    const cachedResult = results.get(dictionary)?.get(value);
    if (cachedResult !== undefined) return cachedResult;

    const cachedFailure = failures.get(dictionary)?.get(value);
    if (cachedFailure !== undefined) throw cachedFailure;

    try {
      const result = fn(value, dictionary);
      if (!results.has(dictionary)) results.set(dictionary, new Map());
      results.get(dictionary)!.set(value, result);
      return result;
    } catch (e) {
      const error = e as CompileError | MultiCompileError;
      if (!failures.has(dictionary)) failures.set(dictionary, new Map());
      failures.get(dictionary)!.set(value, error);
      throw error;
    }
  };
}

export const compile = memoize(compileUncached);

function decompileUncached(value: string, dictionary: Map<number, string>): string {
  const signals = value.split(/ |\n/);
  const errors = [];
  let tokens: string = "";
  for (const signal of signals) {
    if (signal.trim() === "") continue;
    try {
      const number = parseInt(signal);
      if (dictionary.has(number)) {
        tokens = tokens + " " + dictionary.get(number);
      } else {
        const lastChar = tokens.codePointAt(tokens.length - 1) ?? 0;
        if (number >= 0 && number < 10
            && lastChar >= ("0".codePointAt(0) ?? 0)
            && lastChar <= ("9".codePointAt(0) ?? 0)) {
          tokens = tokens + number.toString();
        } else {
          tokens = tokens + " " + number.toString();
        }
      };
    } catch (e) {
      errors.push(new CompileError(`${signal} is not a number`, 0, 0));
    }
  }
  if (errors.length > 0) {
    throw new MultiCompileError(errors);
  }
  return tokens.trim();
}

export const decompile = memoize(decompileUncached);