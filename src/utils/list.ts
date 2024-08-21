import { Stack } from './stack';

export class List<T> extends Stack<T>
{
  private _it: number;

  constructor(preset?: ArrayLike<T>)
  {
    super(preset);

    this._it = 0;
  }

  next(): T|null
  {
    if (this._it < this._arr.length)
    {
      return this._arr[this._it++];
    }
    return null;
  }

  peek(): T|null
  {
    if (this._it < this._arr.length)
    {
      return this._arr[this._it];
    }
    return null;
  }

  isEnd(): boolean
  {
    return this._it >= this._arr.length;
  }

  nextIf(pred: (value: T) => boolean): boolean
  {
    const result = pred(this.peek());
    if (result === true)
    {
      this.next();
    }
    return result;
  }
}
