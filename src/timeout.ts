import { setTimeout } from "node:timers/promises";

class TimeoutError extends Error {}

export async function timeout<T>(ms: number, message: string, promise: PromiseLike<T>): Promise<T> {
  const abortController = new AbortController();

  try {
    const result = await Promise.race([
      promise,
      setTimeout(ms, new TimeoutError(message), { signal: abortController.signal }),
    ]);

    if (result instanceof TimeoutError) {
      throw result;
    }

    return result;
  } finally {
    abortController.abort();
  }
}
