import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DRONE_LABEL, DRONE_REFERENCE_IMAGES, DRONE_TYPES } from './types';
import type { DroneType } from './types';

/**
 * One button per model, opening that model's reference photos - the drone kit
 * and its charger kit, the images the default item lists were read off.
 *
 * Shown on every drone tab so the expected contents of a kit can be checked
 * without leaving the page.
 */
export function DroneImagesBar() {
  const [openFor, setOpenFor] = useState<DroneType | null>(null);

  return (
    <div className="flex flex-wrap gap-2 mb-4" dir="rtl">
      {DRONE_TYPES.map((type) => (
        <Button
          key={type}
          variant="outline"
          size="sm"
          // Clicking the open model again closes it.
          onClick={() => setOpenFor((prev) => (prev === type ? null : type))}
        >
          תמונות ציוד {DRONE_LABEL[type]}
        </Button>
      ))}

      <Dialog open={openFor !== null} onOpenChange={(o) => { if (!o) setOpenFor(null); }}>
        <DialogContent dir="rtl" className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {openFor ? `תמונות ציוד — ${DRONE_LABEL[openFor]}` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {openFor &&
              DRONE_REFERENCE_IMAGES[openFor].map(({ src, caption }) => (
                <figure key={src} className="space-y-1">
                  <figcaption className="text-sm font-medium text-gray-700">
                    {caption}
                  </figcaption>
                  <img
                    src={src}
                    alt={caption}
                    loading="lazy"
                    className="w-full h-auto rounded border bg-white"
                  />
                </figure>
              ))}
          </div>

          <div className="flex justify-start pt-2">
            <Button variant="outline" onClick={() => setOpenFor(null)}>סגירה</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DroneImagesBar;
