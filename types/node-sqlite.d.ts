/**
 * Minimal ambient types for node:sqlite (Node 24), which @types/node@20 predates.
 * Used only by the test harness; bump @types/node to drop this.
 */
declare module "node:sqlite" {
  export class StatementSync {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
