export class Stack<T>
{
  protected _arr: T[];

  constructor(preset?: ArrayLike<T>)
  {
    this._arr = Array.from(preset) ?? [];
  }

  toArray(): T[]
  {
    return this._arr;
  }

  push(item: T)
  {
    this._arr.push(item);
  }

  pop(): T
  {
    if (this.isEmpty())
    {
      throw new Error('Stack underflow');
    }
    return this._arr.pop();
  }

  length(): number
  {
    return this._arr.length;
  }

  isEmpty(): boolean
  {
    return this._arr.length === 0;
  }

  peek(): T
  {
    if (this.isEmpty())
    {
      return null;
    }
    return this._arr[this._arr.length - 1];
  }

  clear(): void
  {
    this._arr = [];
  }
}
