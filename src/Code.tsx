
export const CODE_STORAGE_KEY = 'message-compiler-socket-code';

export function isValidCode(code: number): boolean {
  return /^[0-7]+$/.test(code.toString());
}

export function randomCode(): number {
  return parseInt(
    new Array(4).fill(0)
      .map(_ => Math.floor(Math.random() * 8))
      .join("")
  );
}

export function saveCode(code: number) {
  localStorage.setItem(CODE_STORAGE_KEY, code.toString());
}

export function loadCode(): number {
  try {
    const raw = localStorage.getItem(CODE_STORAGE_KEY);
    if (!raw) throw new Error("No saved code");
    const code = parseInt(raw);
    if (!isValidCode(code)) throw new Error("Invalid code");
    return code;
  } catch {
    alert(`This page is a fan-made server for the game 'A Message from Deep Space'. It's highly recommended that you play that first, as it serves as a 'tutorial' for what you'll learn here (and is just a very good game!)`);
    const newCode = randomCode();
    saveCode(newCode);
    return newCode;
  }
}

export function codeToDecimal(code: number): number {
    if (!isValidCode(code)) throw new Error("Invalid code");
    return parseInt(code.toString(), 8);
}

export function codeFromDecimal(codeDec: number): number {
    return parseInt(codeDec.toString(8).padStart(4, "0"));
}

export function codeToString(code: number): string {
    if (!isValidCode(code)) throw new Error("Invalid code");
    return code.toString().padStart(4, "0");
}