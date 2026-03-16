import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PACT_ACCEPT_HEADER } from '@pact-protocol/core';

/**
 * PACT middleware for Next.js.
 *
 * Checks the Accept header for application/pact+json and sets
 * the X-PACT: 1 response header when present.
 */
export function pactMiddleware(request: NextRequest): NextResponse {
  const accept = request.headers.get('Accept') ?? '';
  const response = NextResponse.next();

  if (accept.includes(PACT_ACCEPT_HEADER)) {
    response.headers.set('X-PACT', '1');
  }

  return response;
}
