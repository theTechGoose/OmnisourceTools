// ============================================
// Deno namespace and globals
// ============================================

declare namespace Deno {
  export function readTextFile(path: string): Promise<string>;
  export function writeTextFile(path: string, data: string): Promise<void>;
  export const args: string[];
  export function stat(path: string): Promise<any>;
  export function readDir(path: string): AsyncIterable<any>;
  export function mkdir(path: string, options?: any): Promise<void>;
  export function remove(path: string, options?: any): Promise<void>;
  export const Command: any;
  export const env: any;
  export const execPath: () => string;
  export function exit(code?: number): never;
}

declare const WebSocket: any;
declare const Response: any;

// ============================================
// Type stubs for external dependencies
// ============================================

// From npm:zod@3.22.4
declare const z: any;

// From jsr:@std/assert@1.0.0
declare const assertEquals: any;

