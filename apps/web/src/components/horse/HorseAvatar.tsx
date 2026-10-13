import { useState, useEffect } from 'react';
import { getFileUrl } from '../../lib/api';

interface HorseAvatarProps {
  photoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  letters?: number;
}

/**
 * Reusable horse avatar component with fallback to initials
 * when photoUrl is null or fails to load.
 */
export function HorseAvatar({
  photoUrl,
  name,
  size = 'md',
  className = '',
  letters = 1,
}: HorseAvatarProps) {
  const [loadError, setLoadError] = useState(false);

  // Reset loadError state whenever photoUrl changes
  useEffect(() => {
    setLoadError(false);
  }, [photoUrl]);

  const resolvedUrl = photoUrl && !loadError ? getFileUrl(photoUrl) : null;
  const sizeClass = size === 'lg' ? 'avatar-lg' : size === 'sm' ? 'avatar-sm' : '';
  const initialText = (name || '?').slice(0, letters).toUpperCase();

  return (
    <div className={`avatar ${sizeClass} ${className}`.trim()}>
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={name}
          onError={() => setLoadError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span>{initialText}</span>
      )}
    </div>
  );
}
