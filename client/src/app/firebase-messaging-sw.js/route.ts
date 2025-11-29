import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Route handler to serve the Firebase messaging service worker
 * This ensures the file is served without any redirects, which is required for service workers
 */
export async function GET(request: NextRequest) {
  try {
    // Read the service worker file from the public directory
    const filePath = join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const fileContent = await readFile(filePath, 'utf-8');

    // Return the file with appropriate headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Service-Worker-Allowed': '/',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error serving service worker:', error);
    return new NextResponse('Service worker not found', { status: 404 });
  }
}
