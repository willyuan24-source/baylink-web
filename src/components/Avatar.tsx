import { User as UserIcon } from 'lucide-react';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}

const Avatar = ({ src, name, size = 10, className = "" }: AvatarProps) => {
    const displaySize = size * 4;
    if (src) return <img src={src} alt={name || "User"} translate="no" loading="lazy" decoding="async" className={`rounded-full object-cover border border-gray-100 bg-white ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
    return <div translate="no" className={`rounded-full bg-gradient-to-br from-[#5a8f72] to-[#3d6b55] text-white flex items-center justify-center font-semibold ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>{name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}</div>;
};

export default Avatar;
