"use node";

/** Pure-JavaScript HEIC decoding runs in Convex's Node action runtime, not V8. */
import convertHeic from 'heic-convert';
import { v } from 'convex/values';
import { internalAction } from '../_generated/server';

export const toJpeg = internalAction({
  args: { bytes: v.bytes(), maxOutputBytes: v.number() },
  handler: async (_ctx, { bytes, maxOutputBytes }) => {
    const jpeg = await convertHeic({ buffer: Buffer.from(bytes), format: 'JPEG', quality: 0.85 });
    const data = new ArrayBuffer(jpeg.byteLength <= maxOutputBytes ? jpeg.byteLength : 0);
    if (jpeg.byteLength <= maxOutputBytes) new Uint8Array(data).set(jpeg);
    return { data, byteSize: jpeg.byteLength };
  },
});
