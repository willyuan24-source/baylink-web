// 文件路径: src/components/PostCard.tsx
import React from 'react';
import { Heart, MessageSquare, MoreHorizontal, MessageCircle } from 'lucide-react';
import Avatar from './Avatar'; // 引入刚才做好的 Avatar
import { PostData } from '../types'; // 引入刚才做好的类型定义

interface PostCardProps {
  post: PostData;
  onClick: () => void;
  onContactClick: (post: PostData) => void;
  onAvatarClick: (userId: string) => void;
  onImageClick: (url: string) => void;
}

const PostCard = ({ post, onClick, onContactClick, onAvatarClick, onImageClick }: PostCardProps) => {
  const isProvider = post.type === 'provider';
  const hasImage = post.imageUrls && post.imageUrls.length > 0;

  return (
    <div onClick={onClick} className="bg-white rounded-[1.5rem] shadow-soft-glow mb-5 overflow-hidden group cursor-pointer border border-white/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="flex justify-between items-center p-4 pb-2">
        <div className="flex gap-3 items-center">
          <div onClick={(e) => { e.stopPropagation(); onAvatarClick && onAvatarClick(post.authorId); }} className="cursor-pointer hover:opacity-80 transition active:scale-95">
              <Avatar src={post.author.avatar} name={post.author.nickname} size={10} />
          </div>
          <div><div className="text-sm font-bold text-gray-900 flex items-center gap-1">{post.author.nickname}</div><div className="text-[10px] text-gray-400 font-medium">{post.city} · {new Date(post.createdAt).toLocaleDateString()}</div></div>
        </div>
        <button className="text-gray-300 hover:text-gray-600 transition"><MoreHorizontal size={20}/></button>
      </div>
      {hasImage ? (
        <div className="relative mt-2">
           <img src={post.imageUrls[0]} alt={post.title} className="w-full h-64 object-cover" onClick={(e) => {e.stopPropagation(); onImageClick(post.imageUrls[0])}}/>
           <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold shadow-lg backdrop-blur-md ${isProvider ? 'bg-green-500/90 text-white' : 'bg-orange-500/90 text-white'}`}>{isProvider ? '🤝 我接单' : '🙋‍♂️ 找帮忙'}</div>
        </div>
      ) : (
        <div className={`mx-4 mt-2 p-6 rounded-2xl ${isProvider ? 'bg-gradient-to-br from-green-50 to-teal-50' : 'bg-gradient-to-br from-orange-50 to-red-50'}`}>
           <div className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold mb-2 ${isProvider ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'}`}>{isProvider ? '提供服务' : '寻求帮助'}</div>
           <h3 className="font-black text-xl text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
           <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed opacity-80">{post.description}</p>
        </div>
      )}
      <div className="p-4 pt-3">
         {hasImage && <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight">{post.title}</h3>}
         {hasImage && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.description}</p>}
         <div className="flex items-center justify-between mb-4"><span className="bg-gray-100 px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-600">#{post.category}</span><div className="font-black text-base text-gray-900">{post.budget}</div></div>
         <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="flex gap-5 text-gray-400">
               <button className="flex items-center gap-1.5 text-xs font-bold hover:text-red-500 transition group/btn"><Heart size={18} className="group-hover/btn:scale-110 transition"/> {post.likesCount}</button>
               <button className="flex items-center gap-1.5 text-xs font-bold hover:text-blue-500 transition"><MessageSquare size={18}/> {post.commentsCount}</button>
            </div>
            <button onClick={(e) => {e.stopPropagation(); onContactClick(post);}} className="text-xs bg-gray-900 text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-gray-800 active:scale-95 transition flex items-center gap-1.5"><MessageCircle size={14} /> 私信</button>
         </div>
      </div>
    </div>
  );
};

export default PostCard;