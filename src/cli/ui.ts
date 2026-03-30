import { block } from '@clack/core';
import { styleText } from 'node:util';
import { intro, outro, note, log, confirm, select, text, isCancel } from '@clack/prompts';

export { intro, outro, note, log, confirm, select, text, isCancel };

// Clack-matching visual constants
const FRAMES = ['◒', '◐', '◓', '◑'];
const S_STEP_SUBMIT = '◇';
const S_STEP_ERROR = '▲';

// ANSI escape helpers (inlined to avoid sisteransi import)
const CSI = '\x1b[';
const CURSOR_TO_0 = `${CSI}1G`;
const ERASE_DOWN = `${CSI}J`;

/**
 * Flicker-free spinner matching @clack/prompts visual style.
 * Batches ANSI clear + redraw into a single stdout.write() per frame.
 */
export function spinner() {
  const output = process.stdout;
  let unblock: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let frameIdx = 0;
  let dotCount = 0;
  let msg = '';
  let rendered = false;

  function clear(): string {
    return rendered ? CURSOR_TO_0 + ERASE_DOWN : '';
  }

  function render() {
    const frame = styleText('magenta', FRAMES[frameIdx]);
    const dots = '.'.repeat(Math.floor(dotCount)).slice(0, 3);
    output.write(clear() + `${frame}  ${msg}${dots}`);
    rendered = true;
    frameIdx = (frameIdx + 1) % FRAMES.length;
    dotCount = dotCount < 4 ? dotCount + 0.125 : 0;
  }

  function finish(symbol: string, message: string) {
    clearInterval(timer);
    output.write(clear() + `${symbol}  ${message || msg}\n`);
    rendered = false;
    unblock?.();
  }

  return {
    start(message: string) {
      unblock = block({ output });
      msg = message.replace(/\.+$/, '');
      frameIdx = 0;
      dotCount = 0;
      rendered = false;
      timer = setInterval(render, 80);
    },
    stop(message = '') {
      finish(styleText('green', S_STEP_SUBMIT), message);
    },
    error(message = '') {
      finish(styleText('red', S_STEP_ERROR), message);
    },
    message(message: string) {
      msg = message.replace(/\.+$/, '');
    },
  };
}

export async function withSpinner<T>(
  startMsg: string,
  fn: () => Promise<T>,
  stopMsg: string | ((result: T) => string),
): Promise<T> {
  const s = spinner();
  s.start(startMsg);
  try {
    const result = await fn();
    s.stop(typeof stopMsg === 'function' ? stopMsg(result) : stopMsg);
    return result;
  } catch (err) {
    s.error(err instanceof Error ? err.message : String(err));
    throw err;
  }
}
