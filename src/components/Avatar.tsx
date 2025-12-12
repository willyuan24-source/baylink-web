// 文件路径: src/components/Avatar.tsx
import React from 'react';
import { User as UserIcon } from 'lucide-react'; // 我们需要引入图标

// 定义组件需要的参数
interface AvatarProps {
  src?: string;
  name?: string;
  size?: number;
  className?: string;
}

const Avatar = ({ src, name, size = 10, className = "" }: AvatarProps) => {
    const displaySize = size * 4; 
    if (src) {
        return <img src={src} alt={name || "User"} className={`rounded-full object-cover border border-gray-100 bg-white ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px` }} />;
    }
    return (
        <div className={`rounded-full bg-gradient-to-br from-green-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-sm ${className}`} style={{ width: `${displaySize}px`, height: `${displaySize}px`, fontSize: `${displaySize * 0.4}px` }}>
            {name ? name[0].toUpperCase() : <UserIcon size={displaySize * 0.5} />}
        </div>
    );
};

export default Avatar;