/**
 * Minimal type declarations for Next.js server module.
 * These provide the types needed for compilation when Next.js
 * is available only as a peer dependency at runtime.
 */
declare module 'next/server' {
  export class NextRequest extends Request {
    readonly nextUrl: URL;
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): Array<{ name: string; value: string }>;
      set(name: string, value: string): void;
      delete(name: string): void;
      has(name: string): boolean;
    };
    readonly geo?: {
      city?: string;
      country?: string;
      region?: string;
      latitude?: string;
      longitude?: string;
    };
    readonly ip?: string;
  }

  export class NextResponse extends Response {
    readonly cookies: {
      get(name: string): { name: string; value: string } | undefined;
      getAll(): Array<{ name: string; value: string }>;
      set(name: string, value: string): void;
      delete(name: string): void;
      has(name: string): boolean;
    };

    static json(body: unknown, init?: ResponseInit): NextResponse;
    static redirect(url: string | URL, status?: number): NextResponse;
    static rewrite(destination: string | URL): NextResponse;
    static next(init?: { headers?: Record<string, string> }): NextResponse;
  }
}
