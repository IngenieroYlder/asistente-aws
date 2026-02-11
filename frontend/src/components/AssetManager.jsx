import React, { useEffect, useState, useRef } from 'react';
import api, { BASE_URL } from '../utils/api';
import { Upload, Copy, Folder, Image as ImageIcon, Plus, Trash2, ChevronRight, MoreVertical } from 'lucide-react';

export const AssetManager = () => {
    const [assets, setAssets] = useState([]);
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null); // null = "Todas"
    const [uploading, setUploading] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showFolderInput, setShowFolderInput] = useState(false);
    const fileInputRef = useRef(null);

    const fetchData = async () => {
        try {
            const [assetsRes, foldersRes] = await Promise.all([
                api.get('/assets', { params: { folderId: selectedFolder, isKnowledge: false } }),
                api.get('/folders')
            ]);
            setAssets(assetsRes.data);
            setFolders(foldersRes.data);
        } catch(e) { console.error(e); }
    };

    useEffect(() => { fetchData(); }, [selectedFolder]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        if (selectedFolder) formData.append('folderId', selectedFolder);

        setUploading(true);
        try {
            await api.post('/assets', formData);
            fetchData();
        } catch (e) { alert('Falló la subida'); }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const createFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await api.post('/folders', { name: newFolderName });
            setNewFolderName('');
            setShowFolderInput(false);
            fetchData();
        } catch (e) { alert('Error al crear carpeta'); }
    };

    const deleteFolder = async (id) => {
        if (!confirm('¿Borrar carpeta? Debe estar vacía.')) return;
        try {
            await api.delete(`/folders/${id}`);
            if (selectedFolder === id) setSelectedFolder(null);
            fetchData();
        } catch (e) { alert(e.response?.data?.message || 'Error al borrar'); }
    };

    const deleteAsset = async (id) => {
        if (!confirm('¿Borrar archivo?')) return;
        try {
            await api.delete(`/assets/${id}`);
            fetchData();
        } catch (e) { alert('Error al borrar'); }
    };

    const copyTag = (name) => {
        navigator.clipboard.writeText(`[SEND_PHOTO: ${name}]`);
        // Simple visual feedback could be a toast, using alert for now
    };

    return (
        <div className="flex gap-6 h-full">
            {/* Sidebar: Folders */}
            <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-700">Carpetas</h3>
                    <button 
                        onClick={() => setShowFolderInput(!showFolderInput)}
                        className="p-1 hover:bg-gray-100 rounded text-blue-600"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {showFolderInput && (
                    <div className="mb-4 flex gap-2">
                        <input 
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="text-sm border rounded p-1 w-full"
                            placeholder="Nombre..."
                            onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                        />
                    </div>
                )}

                <div className="space-y-1 flex-1 overflow-y-auto">
                    <button 
                        onClick={() => setSelectedFolder(null)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedFolder === null ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Folder size={16} /> Todas
                    </button>
                    
                    {folders.map(f => (
                        <div key={f.id} className="group flex items-center">
                            <button 
                                onClick={() => setSelectedFolder(f.id)}
                                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedFolder === f.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Folder size={16} /> 
                                <span className="truncate">{f.name}</span>
                            </button>
                            <button 
                                onClick={() => deleteFolder(f.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all mr-1"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content: Gallery */}
            <div className="flex-1">
                <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Todas las Imágenes'}
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">{assets.length} archivos encontrados</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <div className="relative">
                            <input 
                                type="file" 
                                multiple
                                ref={fileInputRef}
                                onChange={handleUpload} 
                                className="absolute w-full h-full opacity-0 cursor-pointer"
                                disabled={uploading}
                            />
                            <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:shadow-lg transition-all text-sm font-semibold">
                                <Upload size={18} />
                                {uploading ? 'Subiendo...' : 'Subir Fotos'}
                            </button>
                        </div>
                    </div>
                </div>

                {assets.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
                        <ImageIcon size={48} className="mb-2 opacity-20" />
                        <p>No hay imágenes en esta ubicación</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {assets.map(asset => (
                            <div key={asset.id} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden">
                                <div className="h-40 bg-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
                                    <img src={`${BASE_URL}/${asset.url}`} alt={asset.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute top-2 right-2 flex gap-1 transform translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                                        <button 
                                            onClick={() => deleteAsset(asset.id)}
                                            className="p-1.5 bg-white shadow-md text-red-500 rounded-md hover:bg-red-50"
                                            title="Borrar Archivo"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="px-1">
                                    <div className="font-bold text-xs truncate text-gray-700 mb-2" title={asset.name}>{asset.name}</div>
                                    <button 
                                        onClick={() => copyTag(asset.name)}
                                        className="w-full text-[10px] bg-blue-50 text-blue-600 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-colors flex justify-center items-center gap-1 font-bold"
                                    >
                                        <Copy size={12} /> COPIAR TAG
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
