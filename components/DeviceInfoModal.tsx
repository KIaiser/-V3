import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Loader2, Download, Trash2 } from 'lucide-react';
import { storageService } from '../services/storage';
import { FileMetadata } from '../types';
import FileIcon from './FileIcon';

interface DeviceInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  existingFiles: FileMetadata[];
}

const DeviceInfoModal: React.FC<DeviceInfoModalProps> = ({ isOpen, onClose, onUploadComplete, existingFiles }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        // Pass true for isDeviceInfo, undefined for category
        await storageService.saveFile(file, undefined, true);
      }
      onUploadComplete();
      setSelectedFiles([]);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload device information.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (fileMeta: FileMetadata) => {
    try {
        const file = await storageService.getFile(fileMeta.id);
        if (file) {
            const url = URL.createObjectURL(file.content);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.error("Download failed", e);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if(confirm("Delete this device info file?")) {
        await storageService.deleteFile(id);
        onUploadComplete(); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Device Information</h2>
            <p className="text-sm text-slate-500 mt-1">Upload specs, manuals, or device docs</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center cursor-pointer mb-6 flex-shrink-0
            ${dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleChange}
          />
          <FileText className={`w-12 h-12 mb-3 ${dragActive ? "text-blue-500" : "text-slate-400"}`} />
          <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
          <p className="text-xs text-slate-500 mt-1">PDF, Word, Text files supported</p>
        </div>

        {/* Pending Upload File List */}
        {selectedFiles.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-slate-800">Ready to Upload</h3>
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                    {uploading && <Loader2 className="w-3 h-3 animate-spin" />}
                    {uploading ? "Saving..." : "Save Files"}
                </button>
            </div>
            <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon type={file.type} className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{file.name}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                            {(file.size / 1024).toFixed(1)} KB
                        </span>
                    </div>
                    <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 ml-2">
                        <X size={14} />
                    </button>
                </div>
                ))}
            </div>
          </div>
        )}

        {/* Existing Uploaded Files List */}
        {existingFiles.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col border-t pt-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Uploaded Documents</h3>
            <div className="border rounded-lg divide-y overflow-y-auto flex-1 bg-slate-50">
                {existingFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-3 hover:bg-slate-100 transition-colors group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FileIcon type={file.type} className="w-5 h-5 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                                <span className="text-xs text-slate-400">
                                    {(file.size/1024).toFixed(1)} KB • {new Date(file.lastModified).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleDownloadFile(file)} 
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded bg-white border border-slate-200 shadow-sm"
                                title="Download"
                            >
                                <Download size={14} />
                            </button>
                            <button 
                                onClick={() => handleDeleteFile(file.id)} 
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}
        
        {existingFiles.length === 0 && selectedFiles.length === 0 && (
            <div className="text-center text-slate-400 text-sm mt-4">
                No device documents uploaded yet.
            </div>
        )}

        <div className="mt-4 pt-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceInfoModal;