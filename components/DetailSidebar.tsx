import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Download, Trash2, Calendar, HardDrive, Loader2, Tag, X, FileJson, RefreshCw, CheckCircle, AlertCircle, Plus, Minus, FileCheck, RotateCcw, FileText, Check } from 'lucide-react';
import { StoredFile, FileMetadata } from '../types';
import { storageService } from '../services/storage';
import FileIcon from './FileIcon';

interface DetailSidebarProps {
  fileMeta: FileMetadata | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedFile: FileMetadata) => void;
  deviceTypes: string[];
}

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  status?: 'replaced' | 'not-found';
}

const DetailSidebar: React.FC<DetailSidebarProps> = ({ fileMeta, onClose, onDelete, onUpdate, deviceTypes }) => {
  const [fileData, setFileData] = useState<StoredFile | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit Category State
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [tempCategory, setTempCategory] = useState('');

  // Data Merge State
  const [keyValuePairs, setKeyValuePairs] = useState<KeyValuePair[]>([]);
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [mergeMessage, setMergeMessage] = useState('');
  const [dataFileName, setDataFileName] = useState<string | null>(null);
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [savedDataFiles, setSavedDataFiles] = useState<FileMetadata[]>([]);
  const dataInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fileMeta) {
      loadFullFile(fileMeta.id);
      setTempCategory(fileMeta.category || '');
      // Reset merge state on file change
      setKeyValuePairs([]);
      setMergeStatus('idle');
      setMergeMessage('');
      setDataFileName(null);
      setResultFile(null);
      
      // Load saved data files and auto-select the most recent one
      const initDataMerge = async () => {
        try {
          const allFiles = await storageService.getAllMetadata();
          // Filter for files marked as isDataMergeFile AND belong to this specific file
          const dataFiles = allFiles.filter(f => f.isDataMergeFile && f.parentFileId === fileMeta.id);
          setSavedDataFiles(dataFiles);

          if (dataFiles.length > 0) {
            const newestFile = dataFiles[0];
            // Manually trigger selection logic for the newest file
            setMergeStatus('processing');
            setMergeMessage('Loading default data file...');
            const file = await storageService.getFile(newestFile.id);
            if (file) {
              parseAndLoadDataFile(file.content, file.name);
            }
          }
        } catch (error) {
          console.error("Failed to init data merge files", error);
        }
      };
      initDataMerge();

    } else {
      setFileData(null);
    }
  }, [fileMeta]);

  const loadFullFile = async (id: string) => {
    setLoading(true);
    try {
      const data = await storageService.getFile(id);
      if (data) setFileData(data);
    } catch (e) {
      console.error("Failed to load file content", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedDataFiles = async () => {
    if (!fileMeta) return;
    try {
      const allFiles = await storageService.getAllMetadata();
      // Filter for files marked as isDataMergeFile AND belong to this specific file
      const dataFiles = allFiles.filter(f => f.isDataMergeFile && f.parentFileId === fileMeta.id);
      setSavedDataFiles(dataFiles);
    } catch (error) {
      console.error("Failed to load saved data files", error);
    }
  };

  const handleDownloadOriginal = () => {
    if (!fileData) return;
    downloadFile(fileData.content, fileData.name);
  };

  const handleDownloadResult = () => {
    if (!resultFile) return;
    downloadFile(resultFile, resultFile.name);
  };

  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!fileMeta) return;
    
    try {
      await storageService.deleteFile(fileMeta.id);
      onDelete(fileMeta.id);
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete the file. Please try again.");
    }
  };

  const handleSaveCategory = async () => {
    if (!fileMeta) return;
    try {
      await storageService.updateMetadata(fileMeta.id, { category: tempCategory });
      onUpdate({ ...fileMeta, category: tempCategory });
      setIsEditCategoryOpen(false);
    } catch (e) {
      console.error("Failed to update category", e);
      alert("Failed to update device type");
    }
  };

  // --- Data Merge Logic ---

  const searchDeviceInStorage = async (deviceId: string): Promise<{deviceName?: string, model?: string, manufacturer?: string} | null> => {
    try {
      const allFiles = await storageService.getAllMetadata();
      const deviceFiles = allFiles.filter(f => f.isDeviceInfo);

      for (const fileMeta of deviceFiles) {
          const file = await storageService.getFile(fileMeta.id);
          if (!file) continue;

          const fname = file.name.toLowerCase();
          
          // Excel Handler
          if (fname.endsWith('.xlsx') || fname.endsWith('.xls')) {
              const XLSX = (window as any).XLSX;
              if (XLSX) {
                  const buffer = await file.content.arrayBuffer();
                  const workbook = XLSX.read(buffer, { type: 'array' });
                  const sheet = workbook.Sheets[workbook.SheetNames[0]];
                  const json = XLSX.utils.sheet_to_json(sheet);

                  for (const row of json as any[]) {
                      // Find key loosely matching '设备编号'
                      const rowKeys = Object.keys(row);
                      const idKey = rowKeys.find(k => k.trim() === '设备编号');
                      
                      if (idKey && String(row[idKey]).trim() === deviceId.trim()) {
                          const nameKey = rowKeys.find(k => k.trim() === '设备名称');
                          const modelKey = rowKeys.find(k => k.trim() === '型号');
                          const makerKey = rowKeys.find(k => k.trim() === '厂家');
                          
                          return {
                              deviceName: nameKey ? row[nameKey] : undefined,
                              model: modelKey ? row[modelKey] : undefined,
                              manufacturer: makerKey ? row[makerKey] : undefined
                          };
                      }
                  }
              }
          }
          // Word Handler (Table support)
          else if (fname.endsWith('.docx') || fname.endsWith('.doc')) {
              const mammoth = (window as any).mammoth;
              if (mammoth) {
                  const buffer = await file.content.arrayBuffer();
                  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(result.value, 'text/html');
                  
                  const tables = doc.querySelectorAll('table');
                  for (const table of tables) {
                      const rows = Array.from(table.querySelectorAll('tr'));
                      if (rows.length < 2) continue;
                      
                      const headerCells = Array.from(rows[0].querySelectorAll('td, th')).map(c => c.textContent?.trim() || '');
                      const idIndex = headerCells.indexOf('设备编号');
                      
                      if (idIndex !== -1) {
                          for (let i = 1; i < rows.length; i++) {
                              const cells = rows[i].querySelectorAll('td');
                              if (cells[idIndex] && cells[idIndex].textContent?.trim() === deviceId.trim()) {
                                  const nameIndex = headerCells.indexOf('设备名称');
                                  const modelIndex = headerCells.indexOf('型号');
                                  const makerIndex = headerCells.indexOf('厂家');
                                  
                                  return {
                                      deviceName: nameIndex !== -1 ? cells[nameIndex]?.textContent?.trim() : undefined,
                                      model: modelIndex !== -1 ? cells[modelIndex]?.textContent?.trim() : undefined,
                                      manufacturer: makerIndex !== -1 ? cells[makerIndex]?.textContent?.trim() : undefined
                                  };
                              }
                          }
                      }
                  }
              }
          }
      }
    } catch (e) {
      console.warn("Error searching device info", e);
    }
    return null;
  };

  const processData = async (data: Record<string, string>) => {
      // Check for Device ID key ($%设备编号%$ or 设备编号)
      let deviceId = '';
      const deviceIdKey = Object.keys(data).find(k => {
          const clean = k.trim().replace(/^\$%|%\$$/g, '');
          return clean === '设备编号';
      });

      if (deviceIdKey) {
          deviceId = data[deviceIdKey];
      }

      // If ID exists, look up details in Device Info files
      if (deviceId) {
          setMergeMessage(`Found Device ID: ${deviceId}. Searching details...`);
          try {
              const details = await searchDeviceInStorage(deviceId);
              if (details) {
                  if (details.deviceName) data['$%设备名称%$'] = details.deviceName;
                  if (details.model) data['$%型号%$'] = details.model;
                  if (details.manufacturer) data['$%厂家%$'] = details.manufacturer;
              }
          } catch (err) {
              console.error("Device lookup failed", err);
          }
      }

      const pairs: KeyValuePair[] = Object.entries(data).map(([key, value]) => ({
          id: crypto.randomUUID(),
          key,
          value: String(value)
      }));

      if (pairs.length > 0) {
          setKeyValuePairs(pairs);
          setMergeStatus('idle');
          setMergeMessage(`Loaded ${pairs.length} identifiers.`);
      } else {
          setKeyValuePairs([]);
          setMergeStatus('error');
          setMergeMessage("No identifiers found.");
      }
  };

  const handleError = (msg: string) => {
      setMergeStatus('error');
      setMergeMessage(msg);
      setKeyValuePairs([]);
  };

  const parseAndLoadDataFile = (blob: Blob, fileName: string) => {
    setDataFileName(fileName);
    setMergeStatus('processing');
    setMergeMessage('Parsing file...');

    // Handler for JSON/CSV/TXT
    if (fileName.toLowerCase().endsWith('.json') || fileName.toLowerCase().endsWith('.txt') || fileName.toLowerCase().endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                let data: Record<string, string> = {};
                
                try {
                    // Try parsing as JSON first
                    const json = JSON.parse(text);
                    if (Array.isArray(json)) {
                        json.forEach(item => { if (item.key) data[item.key] = item.value || ''; });
                    } else if (typeof json === 'object') {
                        Object.entries(json).forEach(([k, v]) => { if (typeof v === 'string') data[k] = v; });
                    }
                } catch (jsonError) {
                    // Fallback to line-based parsing
                    const lines = text.split('\n');
                    lines.forEach(line => {
                        const trimmed = line.trim();
                        if (!trimmed) return;
                        
                        const match = trimmed.match(/^([^:=,]+)[:=,\t]+(.*)$/);
                        if (match) {
                           data[match[1].trim()] = match[2].trim();
                        } else {
                           const parts = trimmed.split(/\s+/);
                           if (parts.length >= 2) {
                               data[parts[0]] = parts.slice(1).join(' ');
                           } else {
                               data[trimmed] = "";
                           }
                        }
                    });
                }
                await processData(data);
            } catch (err) {
                console.error(err);
                handleError("Failed to parse text file.");
            }
        };
        reader.readAsText(blob);
    }
    // Handler for Excel (.xlsx, .xls)
    else if (fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')) {
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
            handleError("Excel parser library not loaded. Please refresh.");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                let mapping: Record<string, string> = {};
                jsonData.forEach((row: any[]) => {
                    if (row.length >= 1 && row[0] != null) {
                        mapping[String(row[0]).trim()] = String(row[1] || '').trim();
                    }
                });
                await processData(mapping);
            } catch (err) {
                console.error("Excel parse error", err);
                handleError("Failed to parse Excel file.");
            }
        };
        reader.readAsArrayBuffer(blob);
    }
    // Handler for Word (.docx, .doc)
    else if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
        const mammoth = (window as any).mammoth;
        if (!mammoth) {
            handleError("Word parser library not loaded. Please refresh.");
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                
                try {
                    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                    const html = result.value;
                    let mapping: Record<string, string> = {};
                    let foundPairs = false;

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const rows = doc.querySelectorAll('tr');
                    
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 1) {
                            const key = cells[0].textContent?.trim();
                            const value = cells[1]?.textContent?.trim() || "";
                            if (key) {
                                mapping[key] = value;
                                foundPairs = true;
                            }
                        }
                    });

                    if (!foundPairs) {
                         const text = doc.body.textContent || "";
                         const lines = text.split('\n');
                         lines.forEach((line: string) => {
                            const trimmed = line.trim();
                            if (!trimmed) return;
                            const parts = trimmed.split(/[:=]\s*/);
                            if (parts.length >= 1) {
                                const key = parts[0].trim();
                                if (key) {
                                    const value = parts.slice(1).join(' ').trim();
                                    mapping[key] = value;
                                }
                            } else {
                                const spaceParts = trimmed.split(/\t|\s{2,}/);
                                if (spaceParts.length >= 1) {
                                    const key = spaceParts[0].trim();
                                    if (key) {
                                        mapping[key] = spaceParts.slice(1).join(' ').trim();
                                    }
                                }
                            }
                         });
                    }

                    await processData(mapping);
                } catch (err: any) {
                    console.error("Mammoth error", err);
                    handleError("Failed to parse Word file.");
                }
            } catch (err) {
                console.error("Word parse error", err);
                handleError("Failed to read Word file.");
            }
        };
        reader.readAsArrayBuffer(blob);
    }
    else {
        handleError("Unsupported file format.");
    }
  };

  const handleDataFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fileMeta) return;

    try {
        await storageService.saveFile(file, undefined, false, true, fileMeta.id);
        await loadSavedDataFiles(); // Refresh list
    } catch (error) {
        console.error("Failed to save data file to system:", error);
    }

    parseAndLoadDataFile(file, file.name);
  };

  const handleSelectSavedFile = async (meta: FileMetadata) => {
    try {
        setMergeStatus('processing');
        setMergeMessage('Loading file...');
        const file = await storageService.getFile(meta.id);
        if (file) {
            parseAndLoadDataFile(file.content, file.name);
        } else {
            handleError("File not found in storage.");
        }
    } catch (error) {
        handleError("Failed to load saved file.");
    }
  };

  const handleDeleteSavedFile = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        await storageService.deleteFile(id);
        await loadSavedDataFiles();
        // If current file is the deleted one, clear selection
        if (savedDataFiles.find(f => f.id === id)?.name === dataFileName) {
            setDataFileName(null);
            setKeyValuePairs([]);
        }
    } catch (error) {
        console.error("Failed to delete data file", error);
    }
  };

  const handlePairChange = (id: string, field: 'key' | 'value', newValue: string) => {
    setKeyValuePairs(prev => prev.map(p => p.id === id ? { ...p, [field]: newValue, status: undefined } : p));
  };

  const removePair = (id: string) => {
    setKeyValuePairs(prev => prev.filter(p => p.id !== id));
  };

  const addPair = () => {
    setKeyValuePairs(prev => [...prev, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const handleMerge = async () => {
    if (!fileData || keyValuePairs.length === 0) return;

    setMergeStatus('processing');
    setResultFile(null); 

    try {
        // --- DOCX Processing ---
        if (fileData.name.toLowerCase().endsWith('.docx') || fileData.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
             
             const PizZip = (window as any).PizZip;
             const docxtemplater = (window as any).docxtemplater || (window as any).Docxtemplater;
             const mammoth = (window as any).mammoth;

             if (!PizZip || !docxtemplater) {
                throw new Error("Required libraries (PizZip, Docxtemplater) not loaded. Please refresh the page.");
            }

            const arrayBuffer = await fileData.content.arrayBuffer();

            // Check which identifiers exist in the document for visual feedback
            if (mammoth) {
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    const textContent = result.value;
                    
                    const updatedPairs = keyValuePairs.map(p => {
                        let cleanKey = p.key.trim();
                        // Assume docxtemplater is configured with $% %$
                        // If user input is "Key", we look for "$%Key%$"
                        // If user input is "$%Key%$", we look for "$%Key%$"
                        
                        let searchKey = cleanKey;
                        if (!searchKey.startsWith('$%')) searchKey = '$%' + searchKey;
                        if (!searchKey.endsWith('%$')) searchKey = searchKey + '%$';

                        const isFound = textContent.includes(searchKey);
                        return { ...p, status: isFound ? 'replaced' : 'not-found' } as KeyValuePair;
                    });
                    setKeyValuePairs(updatedPairs);
                } catch (e) {
                    console.warn("Could not check identifier existence in docx", e);
                }
            }

            const data: Record<string, string> = {};
            keyValuePairs.forEach(({ key, value }) => {
                let cleanKey = key.trim();
                if (cleanKey.startsWith('$%') && cleanKey.endsWith('%$')) {
                    cleanKey = cleanKey.slice(2, -2);
                }
                data[cleanKey] = value;
            });
            
            const zip = new PizZip(arrayBuffer);
            
            const doc = new docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '$%', end: '%$' }
            });

            doc.render(data);

            const out = doc.getZip().generate({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            
            const outputName = fileData.name.replace(/(\.[\w\d]+)$/, '_merged$1');
            const newFile = new File([out], outputName, {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                lastModified: Date.now()
            });

            setResultFile(newFile);
            setMergeStatus('success');
            setMergeMessage("Processed successfully! Ready to download.");

        } 
        // --- Text/Plain Processing ---
        else {
            const content = await fileData.content.text();
            
            let newContent = content;
            let replacementCount = 0;
            
            const updatedPairs = keyValuePairs.map(p => {
                 let isReplaced = false;
                 if (p.key && newContent.includes(p.key)) {
                    const regex = new RegExp(p.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    const matches = newContent.match(regex);
                    if (matches) {
                        replacementCount += matches.length;
                        isReplaced = true;
                        newContent = newContent.replace(regex, p.value);
                    }
                 }
                 return { ...p, status: isReplaced ? 'replaced' : 'not-found' } as KeyValuePair;
            });
            setKeyValuePairs(updatedPairs);

            const newBlob = new Blob([newContent], { type: fileData.type });
            const outputName = fileData.name.replace(/(\.[\w\d]+)$/, '_merged$1');
            const newFile = new File([newBlob], outputName, { type: fileData.type, lastModified: Date.now() });

            setResultFile(newFile);
            setMergeStatus('success');
            setMergeMessage(`Success! Replaced ${replacementCount} instances.`);
        }

    } catch (err) {
        console.error(err);
        setMergeStatus('error');
        setMergeMessage("Failed to process file. Ensure identifiers match.");
    }
  };


  if (!fileMeta) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col">
        {/* Header Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 z-20">
          <div className="flex items-center gap-4 overflow-hidden flex-1">
              <button 
                onClick={onClose} 
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors font-medium flex-shrink-0"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline">Back</span>
              </button>
              
              <div className="h-8 w-px bg-slate-200 hidden sm:block flex-shrink-0"></div>
              
              <div className="flex flex-col min-w-0">
                 <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-slate-800 truncate" title={fileMeta.name}>
                        {fileMeta.name}
                    </h1>
                    {fileMeta.category && (
                        <span 
                        onDoubleClick={() => setIsEditCategoryOpen(true)}
                        className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs border border-blue-100 font-medium cursor-pointer hover:bg-blue-100 transition-colors select-none whitespace-nowrap"
                        title="Double click to edit device type"
                        >
                        {fileMeta.category}
                        </span>
                    )}
                 </div>
                 <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="uppercase tracking-wider font-semibold">{fileMeta.type.split('/')[1] || 'FILE'}</span>
                 </div>
              </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 pl-4">
             <div className="hidden md:flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2" title="File Size">
                    <HardDrive size={16} />
                    <span>{(fileMeta.size / 1024).toFixed(1)} KB</span>
                </div>
                <div className="flex items-center gap-2" title="Last Modified">
                    <Calendar size={16} />
                    <span>{new Date(fileMeta.lastModified).toLocaleDateString()}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Left Sidebar: Data Merge */}
            <div className="w-96 bg-white border-r border-slate-200 flex flex-col p-4 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 overflow-hidden">
                <div className="flex items-center gap-2 mb-4 text-slate-800 flex-shrink-0">
                    <RefreshCw className="text-blue-600" size={20} />
                    <h2 className="font-bold text-base">Data Merge</h2>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4 flex-shrink-0 flex flex-col max-h-[40vh]">
                    <button 
                        onClick={() => dataInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors mb-3 shadow-sm flex-shrink-0"
                    >
                        <FileJson size={16} />
                        Upload New Data File
                    </button>
                    <input 
                        ref={dataInputRef}
                        type="file" 
                        accept=".json,.csv,.txt,.xlsx,.xls,.docx,.doc"
                        className="hidden"
                        onChange={handleDataFileUpload}
                    />

                    {/* Saved Files List */}
                    <div className="flex-1 overflow-y-auto min-h-0 border-t border-slate-200 pt-2 mb-2">
                        <h3 className="text-xs font-semibold text-slate-500 mb-2 px-1">Saved Data Files</h3>
                        {savedDataFiles.length === 0 ? (
                            <p className="text-xs text-slate-400 px-1 italic">No saved files for this document.</p>
                        ) : (
                            <div className="space-y-1">
                                {savedDataFiles.map(file => (
                                    <div 
                                        key={file.id}
                                        onClick={() => handleSelectSavedFile(file)}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors border ${dataFileName === file.name ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-slate-100'}`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText size={14} className={dataFileName === file.name ? "text-blue-500" : "text-slate-400"} />
                                            <span className={`text-xs truncate ${dataFileName === file.name ? "text-blue-700 font-medium" : "text-slate-600"}`}>
                                                {file.name}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteSavedFile(e, file.id)}
                                            className="text-slate-300 hover:text-red-500 p-1"
                                            title="Delete"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Current File Indicator */}
                    {dataFileName && (
                        <div className="flex items-center gap-2 text-xs text-slate-800 bg-blue-50 border border-blue-100 rounded px-2 py-1.5 shrink-0">
                            <CheckCircle size={12} className="text-green-500" />
                            <span className="truncate font-medium">Active: {dataFileName}</span>
                            <button onClick={() => {setDataFileName(null); setKeyValuePairs([]);}} className="ml-auto hover:text-red-500"><X size={12}/></button>
                        </div>
                    )}
                    
                    {/* Status Messages */}
                    {mergeStatus === 'processing' && (
                        <div className="text-xs text-blue-600 flex items-center gap-1 mt-2 shrink-0">
                            <Loader2 size={12} className="animate-spin" />
                            <span>{mergeMessage}</span>
                        </div>
                    )}
                    {mergeStatus === 'error' && (
                        <div className="text-xs text-red-600 flex items-center gap-1 mt-2 shrink-0">
                            <AlertCircle size={12} />
                            <span>{mergeMessage}</span>
                        </div>
                    )}
                </div>

                {/* Identifiers List */}
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2 px-1 flex-shrink-0">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Identifiers</h3>
                        <button onClick={addPair} className="p-1 hover:bg-slate-100 rounded text-blue-600" title="Add Row">
                            <Plus size={14} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto border rounded-lg bg-slate-50 divide-y divide-slate-100 mb-4">
                        {keyValuePairs.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 italic">
                                Select a file above or add manually.
                            </div>
                        ) : (
                            keyValuePairs.map((pair) => (
                                <div key={pair.id} className="p-2 grid grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-center bg-white">
                                    <input 
                                        type="text" 
                                        value={pair.key}
                                        onChange={(e) => handlePairChange(pair.id, 'key', e.target.value)}
                                        placeholder="Key"
                                        className="w-full text-xs border-b border-transparent focus:border-blue-400 focus:outline-none bg-transparent font-mono text-blue-700"
                                    />
                                    <span className="text-slate-300 text-xs">→</span>
                                    <input 
                                        type="text" 
                                        value={pair.value}
                                        onChange={(e) => handlePairChange(pair.id, 'value', e.target.value)}
                                        placeholder="Value"
                                        className="w-full text-xs border-b border-transparent focus:border-blue-400 focus:outline-none bg-transparent text-slate-700"
                                    />
                                    {/* Status Icon */}
                                    <div className="w-4 flex items-center justify-center">
                                        {pair.status === 'replaced' && <Check className="text-green-500" size={14} />}
                                    </div>
                                    
                                    <button onClick={() => removePair(pair.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Minus size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <button
                        onClick={handleMerge}
                        disabled={mergeStatus === 'processing' || keyValuePairs.length === 0}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
                    >
                        {mergeStatus === 'processing' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        Process Replacement
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-slate-50 relative">
                {resultFile ? (
                    <div className="bg-white p-12 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center justify-center max-w-lg w-full text-center animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <FileCheck size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Processing Complete</h2>
                        <p className="text-slate-500 mb-6">{mergeMessage}</p>
                        
                        <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-4 mb-8 flex items-center gap-3 text-left">
                            <FileIcon type={resultFile.type} className="w-8 h-8 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-800 truncate">{resultFile.name}</p>
                                <p className="text-xs text-slate-400">{(resultFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full">
                            <button 
                                onClick={handleDownloadResult}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Download size={20} />
                                Download Processed File
                            </button>
                            <button 
                                onClick={() => setResultFile(null)}
                                className="w-full py-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={16} />
                                Discard & Return to Original
                            </button>
                        </div>
                    </div>
                ) : (
                    loading ? (
                        <div className="flex flex-col items-center gap-3 text-blue-600">
                            <Loader2 className="w-10 h-10 animate-spin" />
                            <span className="text-sm font-medium">Loading content...</span>
                        </div>
                    ) : fileData ? (
                        fileData.type.startsWith('image/') ? (
                            <img 
                                src={URL.createObjectURL(fileData.content)} 
                                alt={fileData.name} 
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg bg-white"
                                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-6 text-slate-300 w-full max-w-4xl h-full">
                                <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center w-full h-full">
                                    <FileIcon type={fileMeta.type} className="w-32 h-32 md:w-48 md:h-48" />
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="text-slate-400">File not found</div>
                    )
                )}
            </div>
        </div>
      </div>

      {isEditCategoryOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Edit Device Type</h3>
              <button 
                onClick={() => setIsEditCategoryOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Device Type</label>
              <select
                className="w-full px-3 py-2.5 text-sm font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                value={tempCategory}
                onChange={(e) => setTempCategory(e.target.value)}
              >
                <option value="" disabled>Select Type...</option>
                {deviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsEditCategoryOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DetailSidebar;