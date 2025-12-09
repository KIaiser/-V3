import React, { useEffect, useState, useMemo } from 'react';
import { 
  FolderOpen, 
  Search, 
  Grid, 
  List, 
  Plus, 
  Filter, 
  Database,
  Info,
  Trash2,
  Download,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { FileMetadata, ViewMode, FileFilter } from './types';
import { storageService } from './services/storage';
import FileIcon from './components/FileIcon';
import UploadModal from './components/UploadModal';
import DetailSidebar from './components/DetailSidebar';
import AddCategoryModal from './components/AddCategoryModal';
import DeviceInfoModal from './components/DeviceInfoModal';
import SettingsPage from './components/SettingsPage';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [filterType, setFilterType] = useState<FileFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isDeviceInfoOpen, setIsDeviceInfoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Delete Confirmation State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{isOpen: boolean, fileId: string | null, fileName: string}>({
    isOpen: false,
    fileId: null,
    fileName: ''
  });
  
  // Initialize custom categories from localStorage
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('customCategories');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load custom categories", e);
      return [];
    }
  });

  // Load files on mount
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const data = await storageService.getAllMetadata();
      // Filter out files marked as data merge files (hidden from main view)
      setFiles(data.filter(f => !f.isDataMergeFile));
    } catch (error) {
      console.error("Failed to load files", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // Persist custom categories when they change
  useEffect(() => {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
  }, [customCategories]);

  const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts.pop()?.toUpperCase().slice(0, 5);
    }
    return '';
  };

  const handleOpenAddCategory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAddCategoryOpen(true);
  };

  const handleAddCategory = (name: string) => {
    const trimmedName = name.trim();
    // Prevent duplicates and conflict with reserved names
    if (!customCategories.includes(trimmedName) && 
        trimmedName.toUpperCase() !== 'IMAGES' && 
        trimmedName.toUpperCase() !== 'DOCUMENTS' &&
        trimmedName.toUpperCase() !== 'DEVICE TYPE') {
      setCustomCategories([...customCategories, trimmedName]);
    }
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    // Remove immediately for better responsiveness
    setCustomCategories(prev => prev.filter(c => c !== categoryToDelete));
    // If currently selected, reset to ALL
    if (filterType === categoryToDelete) {
      setFilterType('ALL');
    }
  };

  const handleDownload = async (e: React.MouseEvent, fileMeta: FileMetadata) => {
    e.preventDefault();
    e.stopPropagation();
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
    } catch (error) {
      console.error("Download failed", error);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, file: FileMetadata) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirmState({
      isOpen: true,
      fileId: file.id,
      fileName: file.name
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmState.fileId) return;

    try {
        await storageService.deleteFile(deleteConfirmState.fileId);
        // Optimistic update
        setFiles(prev => prev.filter(f => f.id !== deleteConfirmState.fileId));
        // Ensure sync with DB
        await loadFiles();
        
        if (selectedFileId === deleteConfirmState.fileId) setSelectedFileId(null);
    } catch (error) {
        console.error("Delete failed", error);
        alert("Failed to delete file. Please try again.");
        loadFiles(); // Revert state on error
    } finally {
        setDeleteConfirmState({ isOpen: false, fileId: null, fileName: '' });
    }
  };

  // Filter Logic
  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // 1. Search Query
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (file.aiTags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ?? false);
      
      if (!matchesSearch) return false;

      // 2. Type Filter
      if (filterType === 'ALL') return true;
      if (filterType === 'IMAGE') return file.type.startsWith('image/');
      if (filterType === 'VIDEO') return file.type.startsWith('video/');
      if (filterType === 'AUDIO') return file.type.startsWith('audio/');
      if (filterType === 'DOCUMENT') return file.type.includes('pdf') || file.type.includes('text') || file.type.includes('word') || file.type.includes('document');
      
      // 3. Custom Category Filter (Matches Category, Name or Tags)
      if (typeof filterType === 'string') {
        // Strict match on category if present
        if (file.category === filterType) {
          return true;
        }

        const lowerFilter = filterType.toLowerCase();
        // Fallback to name/tags for items without category metadata or if loose matching is desired
        const matchesName = file.name.toLowerCase().includes(lowerFilter);
        const matchesTags = file.aiTags?.some(tag => tag.toLowerCase().includes(lowerFilter));
        return matchesName || matchesTags;
      }

      return true;
    });
  }, [files, searchQuery, filterType]);

  const selectedFileMeta = useMemo(() => 
    files.find(f => f.id === selectedFileId) || null
  , [files, selectedFileId]);

  const totalSize = useMemo(() => 
    files.reduce((acc, curr) => acc + curr.size, 0)
  , [files]);

  const deviceInfoFiles = useMemo(() => 
    files.filter(f => f.isDeviceInfo)
  , [files]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 transition-all hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <FolderOpen size={18} fill="currentColor" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SmartVault</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {/* Device Type Row with Add Button */}
          <div className={`group flex items-center justify-between w-full pr-2 rounded-xl transition-all ${filterType === 'ALL' ? 'bg-slate-800 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800/50'}`}>
            <button 
              onClick={() => setFilterType('ALL')}
              className="flex items-center gap-3 flex-1 px-4 py-3"
            >
              <Grid size={18} />
              <span className="font-medium">Device Type</span>
            </button>
            <button 
              onClick={handleOpenAddCategory}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              title="Add Device Type"
            >
              <Plus size={16} />
            </button>
          </div>
          
          {/* Custom Categories */}
          {customCategories.map((category) => (
            <div key={category} className="relative group">
              <button 
                onClick={() => setFilterType(category)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all ${filterType === category ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50'}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0"></div>
                <span className="font-medium truncate flex-1 text-left">{category}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDeleteCategory(category);
                }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-all z-10 rounded-lg cursor-pointer ${
                  filterType === category ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Delete Device Type"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <Database size={14} />
              <span className="text-xs font-semibold uppercase tracking-wider">Storage</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full mb-2 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full w-1/4"></div> {/* Mock percentage */}
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>{formatSize(totalSize)} used</span>
              <span>Local</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header */}
        <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3 flex-1">
             <div className="relative w-full max-w-md group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="Search files, tags, or descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
             </div>
             <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 flex-shrink-0">
              <button 
                onClick={() => setViewMode(ViewMode.GRID)}
                className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.GRID ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Grid size={18} />
              </button>
              <button 
                onClick={() => setViewMode(ViewMode.LIST)}
                className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.LIST ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDeviceInfoOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
            >
              Device Information
            </button>
            
            <button 
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
            >
              <Plus size={18} />
              <span>Upload</span>
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              title="System Settings"
            >
              <Settings size={22} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth" id="scroll-container">
          {isLoading ? (
             <div className="h-full flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                  <div className="h-12 w-12 bg-slate-200 rounded-full"></div>
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
             </div>
          ) : filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <Filter size={40} className="opacity-20 text-slate-900" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-1">No files found</h3>
              <p className="max-w-xs text-center text-sm">Upload some files to get started or adjust your search filters.</p>
              <button 
                onClick={() => setIsUploadOpen(true)}
                className="mt-6 text-blue-600 font-medium hover:underline"
              >
                Upload Now
              </button>
            </div>
          ) : viewMode === ViewMode.GRID ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
              {filteredFiles.map((file) => (
                <div 
                  key={file.id} 
                  onClick={() => setSelectedFileId(file.id)}
                  className={`group relative bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1
                    ${selectedFileId === file.id ? 'border-blue-500 ring-2 ring-blue-100 shadow-lg' : 'border-slate-200 shadow-sm hover:border-blue-200'}`}
                >
                  {/* Action Buttons - Moved to root for better hit testing */}
                  <button 
                      type="button"
                      onClick={(e) => handleDownload(e, file)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-2 left-2 z-30 p-1.5 bg-white/90 backdrop-blur rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white shadow-sm border border-slate-200 transition-colors"
                      title="Download"
                  >
                      <Download size={16} />
                  </button>

                  <button 
                      type="button"
                      onClick={(e) => handleDeleteClick(e, file)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 z-30 p-1.5 bg-white/90 backdrop-blur rounded-lg text-slate-500 hover:text-red-600 hover:bg-white shadow-sm border border-slate-200 transition-colors"
                      title="Delete"
                  >
                      <Trash2 size={16} />
                  </button>

                  <div className="aspect-square w-full bg-slate-50 rounded-t-2xl flex flex-col items-center justify-center border-b border-slate-50 relative overflow-hidden">
                    <FileIcon type={file.type} className="w-10 h-10 md:w-12 md:h-12 opacity-80 group-hover:scale-110 transition-transform duration-300 mb-2" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 truncate max-w-full">
                       {getFileExtension(file.name) || 'FILE'}
                    </span>
                    
                    {/* Visual Indicator if AI Analyzed */}
                    {(file.aiDescription || file.aiTags) && (
                      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur rounded-full p-1.5 shadow-sm text-purple-600 z-10">
                        <Info size={12} />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-slate-800 text-sm truncate mb-1" title={file.name}>{file.name}</h3>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{formatSize(file.size)}</span>
                      <span>{new Date(file.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden pb-20">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-medium text-xs text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 font-medium text-xs text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 font-medium text-xs text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 font-medium text-xs text-slate-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-4 font-medium text-xs text-slate-500 uppercase tracking-wider">Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFiles.map((file) => (
                    <tr 
                      key={file.id} 
                      onClick={() => setSelectedFileId(file.id)}
                      className={`group cursor-pointer transition-colors ${selectedFileId === file.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <FileIcon type={file.type} className="w-5 h-5" />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 truncate max-w-[200px]">{file.name}</span>
                          {(file.aiDescription || file.aiTags) && (
                            <Info size={14} className="text-purple-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500 truncate max-w-[150px]">{file.type || 'Unknown'}</td>
                      <td className="px-6 py-3 text-sm text-slate-500 truncate max-w-[150px]">
                        {file.category && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                            {file.category}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-500 font-mono">{formatSize(file.size)}</td>
                      <td className="px-6 py-3 text-sm text-slate-500">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Floating Action Button (Mobile) */}
        <button 
          onClick={() => setIsUploadOpen(true)}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-30"
        >
          <Plus size={24} />
        </button>

      </main>

      {/* Modals & Slide-overs */}
      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => {
          loadFiles();
        }}
        deviceTypes={customCategories}
      />
      
      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        onAdd={handleAddCategory}
      />

      <DeviceInfoModal 
        isOpen={isDeviceInfoOpen} 
        onClose={() => setIsDeviceInfoOpen(false)}
        onUploadComplete={() => {
          loadFiles();
        }}
        existingFiles={deviceInfoFiles}
      />

      <SettingsPage 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6 transform scale-100">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Delete File?</h3>
                </div>
                
                <p className="text-slate-600 mb-6 text-sm leading-relaxed ml-1">
                    Are you sure you want to delete <span className="font-semibold text-slate-900 break-all">"{deleteConfirmState.fileName}"</span>? This action cannot be undone.
                </p>
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setDeleteConfirmState({isOpen: false, fileId: null, fileName: ''})}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                    >
                        No, Cancel
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        Yes, Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      <DetailSidebar 
        fileMeta={selectedFileMeta} 
        onClose={() => setSelectedFileId(null)}
        onDelete={(id) => {
          setFiles(prev => prev.filter(f => f.id !== id));
          if (selectedFileId === id) setSelectedFileId(null);
        }}
        onUpdate={(updatedFile) => {
          setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
        }}
        deviceTypes={customCategories}
      />

    </div>
  );
};

export default App;