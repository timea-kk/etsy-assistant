// Reads format, width, and height from PNG or JPEG bytes. No Node APIs.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function readImageInfo(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const bytes = b.byteLength;

  if (bytes >= 24 && PNG_SIGNATURE.every((v, i) => b[i] === v)) {
    return { format: 'png', width: dv.getUint32(16), height: dv.getUint32(20), bytes };
  }

  if (bytes >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 3 < bytes) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) break;
      const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrameHeader && i + 8 < bytes) {
        return { format: 'jpeg', height: dv.getUint16(i + 5), width: dv.getUint16(i + 7), bytes };
      }
      i += 2 + dv.getUint16(i + 2);
    }
    return { format: 'jpeg', width: null, height: null, bytes };
  }

  return { format: 'unknown', width: null, height: null, bytes };
}
