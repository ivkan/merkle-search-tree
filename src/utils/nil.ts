export function isUndefined(value: unknown): value is undefined
{
  return typeof value === 'undefined';
}

export function isNull(value: unknown): value is null
{
  return value === null;
}

export function notNil(value: unknown): boolean
{
  return !isNull(value) && !isUndefined(value);
}

export function isNil(value: unknown): boolean
{
  return isNull(value) || isUndefined(value);
}
