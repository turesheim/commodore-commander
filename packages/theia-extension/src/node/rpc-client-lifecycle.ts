import type { Disposable, Event } from '@theia/core/lib/common';

interface RpcConnectionAwareClient {
  readonly onDidCloseConnection?: Event<void>;
}

export function observeRpcClientClose<T extends object>(
  client: T | undefined,
  onClose: (client: T) => void
): Disposable | undefined {
  if (!client) {
    return undefined;
  }
  const onDidCloseConnection =
    (client as RpcConnectionAwareClient).onDidCloseConnection;
  if (typeof onDidCloseConnection !== 'function') {
    return undefined;
  }
  return onDidCloseConnection.call(client, () => onClose(client));
}
