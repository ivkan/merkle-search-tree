const hasUint8Array = (typeof Uint8Array === 'function');
const toStr         = Object.prototype.toString;

function nativeClass(v: unknown): string
{
    return toStr.call(v);
}

export function isUint8Array(value: unknown): value is Uint8Array
{
    return (
        (hasUint8Array && value instanceof Uint8Array) || nativeClass(value) === '[object Uint8Array]'
    );
}
