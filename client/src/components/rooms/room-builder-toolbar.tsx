'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Link2, Maximize2, Save, Loader2 } from 'lucide-react';

interface RoomBuilderToolbarProps {
  mode: 'select' | 'add-room' | 'add-edge';
  onModeChange: (mode: 'select' | 'add-room' | 'add-edge') => void;
  onAutoLayout: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function RoomBuilderToolbar({
  mode,
  onModeChange,
  onAutoLayout,
  onSave,
  isSaving,
}: RoomBuilderToolbarProps) {
  return (
    <Card className="absolute top-4 left-4 z-10 p-2">
      <div className="flex items-center space-x-2">
        <Button
          variant={mode === 'add-room' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange(mode === 'add-room' ? 'select' : 'add-room')}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Room
          {mode === 'add-room' && (
            <Badge variant="secondary" className="ml-2">Active</Badge>
          )}
        </Button>

        <Button
          variant={mode === 'add-edge' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onModeChange(mode === 'add-edge' ? 'select' : 'add-edge')}
        >
          <Link2 className="h-4 w-4 mr-2" />
          Add Edge
          {mode === 'add-edge' && (
            <Badge variant="secondary" className="ml-2">Active</Badge>
          )}
        </Button>

        <div className="w-px h-6 bg-border" />

        <Button variant="outline" size="sm" onClick={onAutoLayout}>
          <Maximize2 className="h-4 w-4 mr-2" />
          Auto Layout
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>
    </Card>
  );
}
