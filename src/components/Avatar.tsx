import { User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import type { ProfileTheme } from '../lib/types';

const tones = {
  bay: ['#286c81', '#164856'], sunset: ['#ac5746', '#753b4b'],
  redwood: ['#547650', '#304d3b'], lavender: ['#79608e', '#4d4168'],
};
const initial = (name: string) => {
  const clean = name.trim();
  if (!clean) return '';
  const words = clean.split(/\s+/);
  if (words.length > 1 && words.every(word => /^[a-z]/i.test(word))) return `${words[0][0]}${words.at(-1)![0]}`.toUpperCase();
  return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(clean)][0]?.segment.toUpperCase() || '';
};

interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
  theme?: ProfileTheme;
}

const Avatar = ({ src, name, size = 10, className = "", theme }: AvatarProps) => {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const displaySize = size * 4;
    if (src && src !== failedSrc) return <img src={src} alt={name || "User"} translate="no" loading="lazy" decoding="async" onError={() => setFailedSrc(src)} className={`rounded-full object-cover border border-gray-100 bg-white shrink-0 ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
    const hash = [...(name || '')].reduce((value, character) => (value * 31 + character.codePointAt(0)!) >>> 0, 0);
    const colors = tones[theme || (Object.keys(tones)[hash % 4] as ProfileTheme)] || tones.bay;
    return <div translate="no" role="img" aria-label={name || 'User'} className={`rounded-full text-white flex items-center justify-center font-semibold shrink-0 ${className}`} style={{ background: `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`, width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.36}px` }}>{name ? initial(name) : <UserIcon size={displaySize * 0.5} />}</div>;
};

export default Avatar;
