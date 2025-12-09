import { StoredFile, FileMetadata } from '../types';

const DB_NAME = 'SmartVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('lastModified', 'lastModified', { unique: false });
        }
      };
    });
  }

  async saveFile(
    file: File, 
    category?: string, 
    isDeviceInfo: boolean = false, 
    isDataMergeFile: boolean = false,
    parentFileId?: string
  ): Promise<StoredFile> {
    if (!this.db) await this.init();

    const id = crypto.randomUUID();
    const storedFile: StoredFile = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      content: file, // File inherits from Blob
      category: category,
      isDeviceInfo: isDeviceInfo,
      isDataMergeFile: isDataMergeFile,
      parentFileId: parentFileId,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(storedFile);

      request.onsuccess = () => resolve(storedFile);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMetadata(): Promise<FileMetadata[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll(); // Getting all might be heavy for blobs, ideally use cursor to only get metadata

      // Optimization: In a real large-scale app, we would separate metadata and blobs into two stores.
      // For this demo, we'll strip the blob from the result here to keep UI lightweight.
      request.onsuccess = () => {
        const files = request.result as StoredFile[];
        const metadata = files.map(({ content, ...meta }) => meta);
        // Sort by newest first
        resolve(metadata.sort((a, b) => b.lastModified - a.lastModified));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getFile(id: string): Promise<StoredFile | undefined> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateMetadata(id: string, updates: Partial<FileMetadata>): Promise<void> {
    if (!this.db) await this.init();

    const file = await this.getFile(id);
    if (!file) throw new Error('File not found');

    const updatedFile = { ...file, ...updates };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updatedFile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const storageService = new StorageService();