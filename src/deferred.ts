export interface Deferred<T> extends PromiseLike<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"], reject: Deferred<T>["reject"];

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    then: promise.then.bind(promise),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- promise executor called synchronously
    resolve: resolve!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- promise executor called synchronously
    reject: reject!,
  };
}
