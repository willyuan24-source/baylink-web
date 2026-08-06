import { X } from 'lucide-react';

export const ImageViewer = ({ src, onClose }: { src: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
    <button onClick={onClose} className="absolute top-[calc(env(safe-area-inset-top,0px)+24px)] right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/30 transition"><X size={24}/></button>
    <img src={src} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-300" onClick={e => e.stopPropagation()} />
  </div>
);
