import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  // Construct the Firebase configuration object from environment variables
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_WEB_API_KEY,
    authDomain: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Validate that required config is present
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.error('Missing required Firebase configuration');
    return new NextResponse(
      'console.error("Missing Firebase configuration. Please check environment variables.");',
      {
        status: 500,
        headers: {
          'Content-Type': 'application/javascript',
        },
      }
    );
  }

  try {
    const swFilePath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
    // Read the service worker template
    const swTemplate = await fs.readFile(swFilePath, 'utf-8');

    // Replace the placeholder with the actual config
    const swContent = swTemplate.replace(
      'self.__FIREBASE_CONFIG__',
      JSON.stringify(firebaseConfig)
    );

    // Return the customized service worker
    return new NextResponse(swContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/',
      },
    });
  } catch (error) {
    console.error('Error generating service worker:', error);
    return new NextResponse(
      'Could not generate service worker.',
      { status: 500 }
    );
  }
}
