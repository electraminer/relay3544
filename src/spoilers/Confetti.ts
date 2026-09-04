import confetti from "@hiseb/confetti";
import type { Message } from "../Message";

export function renderConfetti(message: Message): void {
  // ignore channel
  const signals =
    message.signals[0] === -65535 && message.signals[1] >= 0
      ? message.signals.slice(2)
      : [...message.signals];
  // check if all signals in the message are -702
  if (signals.some((signal) => signal !== -702)) return;
  confetti({
    position: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.75 },
    // The more times the signal -702 is in the message, the more confetti will be rendered.
    // Maxes out at 800 (8 instances of signal -702)
    count: 100 * Math.min(8, signals.length),
    velocity: 300,
  });
}
