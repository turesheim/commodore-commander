import { FileUri } from '@theia/core/lib/common/file-uri';
import URI from '@theia/core/lib/common/uri';

/** Convert capture file paths without mistaking a Windows drive for a URI scheme. */
export function toScreenCaptureUri(value: string): URI {
  if (/^[a-z]:[\\/]/iu.test(value) || value.startsWith('\\\\')) {
    return FileUri.create(value.replace(/\\/gu, '/'));
  }
  return /^[a-z][a-z0-9+.-]*:/iu.test(value) ? new URI(value) : FileUri.create(value);
}
