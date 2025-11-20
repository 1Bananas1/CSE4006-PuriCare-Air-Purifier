import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { fanSpeed, autoMode, sensitivity } = body;

    const updates: any = {};
    if (fanSpeed !== undefined) updates.fanSpeed = fanSpeed;
    if (autoMode !== undefined) updates.autoMode = autoMode;
    if (sensitivity !== undefined) updates.sensitivity = sensitivity;

    const deviceRef = doc(db, 'devices', id);
    await updateDoc(deviceRef, updates);

    return NextResponse.json({ success: true, message: 'Settings updated' });
  } catch (error: any) {
    console.error('Error updating device settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
