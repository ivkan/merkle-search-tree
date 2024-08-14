export class InsertIntermediate<T> {
  key: T

  constructor(key: T) {
    this.key = key
  }
}

export type Complete = 'Complete';
export type IUpsertResult<T> = Complete | InsertIntermediate<T>;
export const UpsertResult = {
  Complete: 'Complete' as Complete,
  InsertIntermediate: InsertIntermediate,
}
