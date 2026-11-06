// One trade as Yahoo's live price feed pushes it: the PricingData message
// behind finance.yahoo.com's live prices. Only the fields Portifo reads are
// kept. Ported from Portifo Bar (portifo-mac), which reads the same feed.
export type Tick = {
  symbol: string;
  price: number;
  // When the trade was struck, epoch ms.
  time: number;
  // Yahoo's session flag: 0 pre-market, 1 regular, 2 post-market, 3
  // extended. proto3 leaves a 0 off the wire, so a missing flag reads as 0.
  marketHours: number;
};

// Field numbers from Yahoo's pricing.proto, checked against live frames:
// 1 id, 2 price (float), 3 time (sint64, epoch ms), 7 market hours (int32).
export function decodePricingData(bytes: Uint8Array): Tick | null {
  let symbol: string | undefined;
  let price: number | undefined;
  let time: number | undefined;
  let marketHours = 0;
  try {
    for (const { field, value } of readFields(bytes)) {
      switch (field) {
        case 1:
          symbol = asString(value);
          break;
        case 2:
          price = asFloat(value);
          break;
        case 3:
          time = asSint64(value);
          break;
        case 7:
          marketHours = asInt(value) ?? 0;
          break;
      }
    }
  } catch {
    return null;
  }
  if (!symbol || price == null || !Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    price: quoted(price),
    time: time ?? Date.now(),
    marketHours,
  };
}

// One text frame from the feed. With `?version=2` each is JSON,
// `{"type":"pricing","message":"<base64 PricingData>"}`; the original
// protocol sent the base64 alone. Both are read.
export function decodeFrame(frame: string): Tick | null {
  let payload = frame;
  if (frame.startsWith("{")) {
    let envelope: { type?: string; message?: string };
    try {
      envelope = JSON.parse(frame);
    } catch {
      return null;
    }
    if ((envelope.type != null && envelope.type !== "pricing") || typeof envelope.message !== "string") return null;
    payload = envelope.message;
  }
  if (!/^[A-Za-z0-9+/]+=*$/.test(payload)) return null;
  return decodePricingData(Buffer.from(payload, "base64"));
}

// The feed sends prices as 32-bit floats, so 348.18 arrives as
// 348.17999267578125. The shortest decimal that reads back as that same float
// is the price as it was quoted.
function quoted(value: number): number {
  for (let digits = 1; digits <= 9; digits++) {
    const candidate = Number(value.toPrecision(digits));
    if (Math.fround(candidate) === value) return candidate;
  }
  return value;
}

// Just enough of the protobuf wire format to read PricingData: no schema
// compiler and no dependency. A field this doesn't read is skipped by its wire
// type, so fields Yahoo adds later pass harmlessly.
type WireValue =
  | { kind: "varint"; raw: bigint }
  | { kind: "fixed64"; bytes: Uint8Array }
  | { kind: "bytes"; bytes: Uint8Array }
  | { kind: "fixed32"; bytes: Uint8Array };

function* readFields(data: Uint8Array): Generator<{ field: number; value: WireValue }> {
  let offset = 0;

  const varint = (): bigint => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (offset >= data.length) throw new Error("truncated");
      const byte = data[offset++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result & 0xffff_ffff_ffff_ffffn;
      shift += 7n;
      if (shift >= 70n) throw new Error("malformed");
    }
  };

  const take = (length: number): Uint8Array => {
    if (length < 0 || data.length - offset < length) throw new Error("truncated");
    const bytes = data.subarray(offset, offset + length);
    offset += length;
    return bytes;
  };

  while (offset < data.length) {
    const key = varint();
    const field = Number(key >> 3n);
    switch (Number(key & 7n)) {
      case 0:
        yield { field, value: { kind: "varint", raw: varint() } };
        break;
      case 1:
        yield { field, value: { kind: "fixed64", bytes: take(8) } };
        break;
      case 2:
        yield { field, value: { kind: "bytes", bytes: take(Number(varint())) } };
        break;
      case 5:
        yield { field, value: { kind: "fixed32", bytes: take(4) } };
        break;
      default:
        // Groups (3, 4) are long deprecated; nothing else is valid.
        throw new Error("malformed");
    }
  }
}

function asString(v: WireValue): string | undefined {
  return v.kind === "bytes" ? Buffer.from(v.bytes).toString("utf8") : undefined;
}

// Little-endian, as the wire format stores fixed-width fields.
function asFloat(v: WireValue): number | undefined {
  if (v.kind !== "fixed32") return undefined;
  return new DataView(v.bytes.buffer, v.bytes.byteOffset, 4).getFloat32(0, true);
}

// int32 and int64: a plain varint, two's complement.
function asInt(v: WireValue): number | undefined {
  return v.kind === "varint" ? Number(BigInt.asIntN(64, v.raw)) : undefined;
}

// sint32 and sint64: zigzag-encoded, so small negatives stay short.
function asSint64(v: WireValue): number | undefined {
  return v.kind === "varint" ? Number((v.raw >> 1n) ^ -(v.raw & 1n)) : undefined;
}
