declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean; readOnly?: boolean });
    prepare(sql: string): {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      all(...params: any[]): any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get(...params: any[]): any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
    };
    exec(sql: string): void;
    close(): void;
  }
}
