const taggedValue = '__finappLocalValue__';
const stringEscapePrefix = '__finappString__:';
const legacyBigInt = /^-?\d+n$/;
const integerText = /^-?\d+$/;

type TaggedValue = { [taggedValue]: 'bigint'; value: string };

export function serializeLocalValue(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) => {
    if (typeof item === 'bigint') return { [taggedValue]: 'bigint', value: item.toString() };
    if (
      typeof item === 'string' &&
      (legacyBigInt.test(item) || item.startsWith(stringEscapePrefix))
    )
      return `${stringEscapePrefix}${item}`;
    return item;
  });
}

export function deserializeLocalValue<T>(value: string): T {
  return JSON.parse(value, (_, item: unknown) => {
    if (typeof item === 'string' && item.startsWith(stringEscapePrefix))
      return item.slice(stringEscapePrefix.length);
    if (typeof item === 'string' && legacyBigInt.test(item)) return BigInt(item.slice(0, -1));
    if (!item || typeof item !== 'object' || !(taggedValue in item)) return item;
    const tagged = item as TaggedValue;
    if (tagged[taggedValue] === 'bigint' && integerText.test(tagged.value))
      return BigInt(tagged.value);
    return item;
  }) as T;
}
