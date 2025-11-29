import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Route handler to serve the Firebase messaging service worker
 * This ensures the file is served without any redirects, which is required for service workers
 * It also dynamically injects the Firebase configuration into the service worker
 */
export async function GET(request: NextRequest) {
  try {
    // Construct the Firebase config from environment variables
    const firebaseConfig = {
      apiKey:
        process.env.NEXT_PUBLIC_FIREBASE_WEB_API_KEY ||
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: `${
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cse4006'
      }.firebaseapp.com`,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cse4006',
      storageBucket: `${
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cse4006'
      }.appspot.com`,
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    };

    // Create the script to inject the config
    const configScript = `self.__FIREBASE_CONFIG__ = ${JSON.stringify(
      firebaseConfig
    )};`;

    // Read the original service worker file
    const filePath = join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    const fileContent = await readFile(filePath, 'utf-8');

    // Prepend the config script to the file content
    const finalScript = `${configScript}\n\n${fileContent}`;

    // Return the file with appropriate headers
    return new NextResponse(finalScript, {
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
