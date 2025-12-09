import React from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Code, 
  FileArchive, 
  File, 
  FileSpreadsheet,
  FileBox
} from 'lucide-react';

interface FileIconProps {
  type: string;
  className?: string;
}

const FileIcon: React.FC<FileIconProps> = ({ type, className = "w-6 h-6" }) => {
  if (type.startsWith('image/')) return <ImageIcon className={`text-purple-500 ${className}`} />;
  if (type.startsWith('audio/')) return <Music className={`text-pink-500 ${className}`} />;
  if (type.startsWith('video/')) return <Video className={`text-red-500 ${className}`} />;
  
  if (type.includes('pdf')) return <FileText className={`text-orange-500 ${className}`} />;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className={`text-green-600 ${className}`} />;
  if (type.includes('zip') || type.includes('compressed') || type.includes('tar')) return <FileArchive className={`text-yellow-600 ${className}`} />;
  
  if (
    type.includes('javascript') || 
    type.includes('json') || 
    type.includes('html') || 
    type.includes('css') ||
    type.includes('xml')
  ) return <Code className={`text-blue-500 ${className}`} />;

  if (type.startsWith('text/')) return <FileText className={`text-slate-500 ${className}`} />;

  return <FileBox className={`text-slate-400 ${className}`} />;
};

export default FileIcon;