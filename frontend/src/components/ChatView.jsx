import React, { useEffect, useState, useRef } from 'react';
import api, { BASE_URL } from '../utils/api';
import { Send, Pause, Play, Clock, Image as ImageIcon, Smartphone, MessageCircle, User, Paperclip, X, Video, ExternalLink, Plus, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { formatTime } from '../utils/dateUtils';


export const ChatView = ({ sessionId }) => {
    const [messages, setMessages] = useState([]);
    const [session, setSession] = useState(null);
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previews, setPreviews] = useState([]);
    const [pauseValue, setPauseValue] = useState(30);
    const [pauseUnit, setPauseUnit] = useState('min');
    
    // Media & UI Enhancements State
    const [previewAsset, setPreviewAsset] = useState(null);
    const [showGalleryPicker, setShowGalleryPicker] = useState(false);
    const [galleryAssets, setGalleryAssets] = useState([]);
    const [buttons, setButtons] = useState([]); // Array of { label, url }
    
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);
    const lastMessageCount = useRef(0);

    const fetchMessagesAndSession = async (isInitial = false) => {
        try {
            const res = await api.get(`/messages/${sessionId}`);
            setMessages(res.data);
            if (isInitial) lastMessageCount.current = res.data.length;
            
            const sessionsRes = await api.get('/sessions');
            const current = sessionsRes.data.find(s => s.id === sessionId);
            if (current) setSession(current);
        } catch (e) { console.error(e); }
    };

    const fetchGalleryAssets = async () => {
        try {
            const res = await api.get('/assets');
            setGalleryAssets(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchMessagesAndSession(true);
        fetchGalleryAssets();
        const interval = setInterval(() => fetchMessagesAndSession(false), 3000);
        return () => clearInterval(interval);
    }, [sessionId]);

    const scrollContainerRef = useRef(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setShouldAutoScroll(isAtBottom);
    };

    useEffect(() => {
        if (messages.length > lastMessageCount.current) {
            if (shouldAutoScroll) {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
            lastMessageCount.current = messages.length;
        }
    }, [messages, shouldAutoScroll]);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
        
        const newPreviews = files.map(file => ({
            url: URL.createObjectURL(file),
            type: file.type.startsWith('video') ? 'video' : 'image',
            name: file.name
        }));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async (fromGalleryAsset = null) => {
        if ((!inputText.trim() && selectedFiles.length === 0 && !fromGalleryAsset && !buttons.length) || isSending) return;
        setIsSending(true);
        
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('text', inputText);
        formData.append('buttons', JSON.stringify(buttons));

        if (fromGalleryAsset) {
            formData.append('existingAssetUrl', fromGalleryAsset.url);
        } else {
            selectedFiles.forEach(file => {
                formData.append('files', file);
            });
        }

        try {
            await api.post('/send-manual', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setInputText('');
            setSelectedFiles([]);
            setPreviews([]);
            setButtons([]);
            fetchMessagesAndSession();
        } catch (e) { alert("Error enviando mensaje"); }
        finally { setIsSending(false); }
    };

    const addButton = () => {
        const label = prompt("Texto del botón:", "Saber más");
        const url = prompt("URL del botón (http...):", "https://");
        if (label && url) {
            setButtons([...buttons, { label, url }]);
        }
    };

    const handlePause = async (manualMinutes = null) => {
        if (!session) return;
        
        let minutes = manualMinutes;
        if (minutes === null) {
            // Calculate based on custom picker
            const val = parseInt(pauseValue);
            if (pauseUnit === 'min') minutes = val;
            else if (pauseUnit === 'hour') minutes = val * 60;
            else if (pauseUnit === 'day') minutes = val * 1440;
            else if (pauseUnit === 'week') minutes = val * 10080;
        }

        try {
            await api.post('/pause-contact', { 
                contactId: session.Contact.id, 
                durationMinutes: minutes 
            });
            fetchMessagesAndSession();
        } catch (e) { alert("Error pausando bot"); }
    };

    if (!session) return <div className="h-full flex items-center justify-center text-gray-400">Selecciona un chat</div>;

    const contact = session.Contact;
    const isPaused = contact.bot_paused_until && new Date(contact.bot_paused_until) > new Date();

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header / Info */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3">
                    <div 
                        onClick={() => contact.avatar_url && setPreviewAsset({ url: contact.avatar_url.startsWith('http') ? contact.avatar_url : `${BASE_URL}/${contact.avatar_url}`, name: contact.first_name })}
                        className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all overflow-hidden"
                    >
                        {contact.avatar_url ? <img src={contact.avatar_url.startsWith('http') ? contact.avatar_url : `${BASE_URL}/${contact.avatar_url}`} className="w-full h-full object-cover" /> : <User size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-800 leading-tight">{contact.first_name} {contact.platform_id.includes('@') ? `(${contact.platform_id})` : ''}</h4>
                            {contact.platform_link && (
                                <a href={contact.platform_link} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">{contact.platform}</span>
                            {contact.username && <span className="text-[10px] text-gray-300">@{contact.username}</span>}
                        </div>
                        {contact.bio && <p className="text-[10px] text-gray-400 italic max-w-xs truncate" title={contact.bio}>{contact.bio}</p>}
                    </div>
                </div>

                <div className="flex gap-2">
                    {isPaused ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-orange-500 animate-pulse uppercase">Modo Humano Activo</span>
                            <button 
                                onClick={() => handlePause(0)} 
                                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-sm"
                                title="Reactivar Bot"
                            >
                                <Play size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white border p-1.5 rounded-xl shadow-sm">
                            <Clock size={14} className="text-gray-400 ml-1" />
                            <input 
                                type="number" 
                                value={pauseValue} 
                                onChange={(e) => setPauseValue(e.target.value)}
                                className="w-12 text-center text-xs border-0 focus:ring-0 p-0 font-bold"
                            />
                            <select 
                                value={pauseUnit} 
                                onChange={(e) => setPauseUnit(e.target.value)}
                                className="text-[10px] font-bold uppercase border-0 focus:ring-0 p-0 bg-transparent text-gray-500"
                            >
                                <option value="min">Min</option>
                                <option value="hour">Hor</option>
                                <option value="day">Día</option>
                                <option value="week">Sem</option>
                            </select>
                            <button 
                                onClick={() => handlePause()}
                                className="bg-orange-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-orange-600 transition"
                            >
                                Pausar
                            </button>
                            <button 
                                onClick={() => handlePause(-1)}
                                className="text-gray-400 hover:text-red-500 transition px-1"
                                title="Pausa Indefinida"
                            >
                                <Pause size={14} />
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Gallery Picker Menu Toggle */}
                <button 
                    onClick={() => setShowGalleryPicker(!showGalleryPicker)}
                    className={`p-2 rounded-xl transition-all ${showGalleryPicker ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-gray-500 hover:bg-gray-50'}`}
                    title="Galería de la Empresa"
                >
                    <ImageIcon size={20} />
                </button>
            </div>

            {/* Gallery Picker Overlay */}
            {showGalleryPicker && (
                <div className="bg-gray-50 border-b p-4 animate-in slide-in-from-top duration-300">
                    <div className="flex justify-between items-center mb-3">
                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Enviar desde Galería</h5>
                        <button onClick={() => setShowGalleryPicker(false)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {galleryAssets.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">No hay archivos en la galería.</div>
                        ) : (
                            galleryAssets.map(asset => (
                                <div 
                                    key={asset.id} 
                                    onClick={() => { handleSend(asset); setShowGalleryPicker(false); }}
                                    className="w-24 h-24 flex-shrink-0 relative group cursor-pointer rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all shadow-sm"
                                >
                                    <img src={`${BASE_URL}/${asset.url}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Plus size={20} className="text-white" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] p-1 truncate font-bold">
                                        {asset.name}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Chat History */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto p-6 space-y-4 bg-gray-100"
            >
                {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const msgButtons = msg.buttons ? (typeof msg.buttons === 'string' ? JSON.parse(msg.buttons) : msg.buttons) : [];

                    return (
                        <div key={msg.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${
                                isUser ? 'bg-white text-gray-800 border border-gray-100 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'
                            }`}>
                                {msg.content_type === 'image' && msg.media_url && (
                                    <div 
                                        onClick={() => setPreviewAsset({ url: msg.media_url.startsWith('http') ? msg.media_url : `${BASE_URL}/${msg.media_url}`, name: 'Imagen Adjunta' })}
                                        className="mb-2 -mx-2 -mt-1 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 max-w-[200px] h-48 bg-gray-50 flex items-center justify-center border border-gray-100/10"
                                    >
                                        <img 
                                            src={msg.media_url.startsWith('http') ? msg.media_url : `${BASE_URL}/${msg.media_url}`} 
                                            className="w-full h-full object-cover" 
                                            loading="lazy"
                                        />
                                    </div>
                                )}
                                
                                {msg.content_type === 'audio' && msg.media_url && (
                                    <audio controls className="mb-2 max-w-full h-8">
                                        <source src={msg.media_url.startsWith('http') ? msg.media_url : `${BASE_URL}/${msg.media_url}`} type="audio/ogg" />
                                    </audio>
                                )}

                                {msg.content_type === 'video' && msg.media_url && (
                                    <div className="mb-2 -mx-2 -mt-1 rounded-xl overflow-hidden max-w-[240px]">
                                        <video 
                                            controls 
                                            src={msg.media_url.startsWith('http') ? msg.media_url : `${BASE_URL}/${msg.media_url}`} 
                                            className="w-full"
                                        />
                                    </div>
                                )}

                                <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                                
                                {msgButtons.length > 0 && (
                                    <div className="mt-3 flex flex-col gap-2">
                                        {msgButtons.map((btn, idx) => (
                                            <a 
                                                key={idx}
                                                href={btn.url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className={`text-[10px] font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-2 border transition-all ${
                                                    isUser ? 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                                                }`}
                                            >
                                                {btn.label} <ExternalLink size={10} />
                                            </a>
                                        ))}
                                    </div>
                                )}

                                <div className={`text-[9px] mt-1.5 opacity-40 uppercase font-bold text-right`}>
                                    {formatTime(msg.timestamp)}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Previews */}
            {previews.length > 0 && (
                <div className="p-3 border-t flex gap-3 overflow-x-auto bg-gray-50">
                    {previews.map((prev, i) => (
                        <div key={i} className="relative w-20 h-20 flex-shrink-0">
                            {prev.type === 'image' ? (
                                <img src={prev.url} className="w-full h-full object-cover rounded-lg border" />
                            ) : (
                                <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center border text-gray-500">
                                    <Video size={24} />
                                </div>
                            )}
                            <button 
                                onClick={() => removeFile(i)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-lg"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer / Input */}
            <div className="p-4 border-t bg-white">
                <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={isPaused ? "Escribe una respuesta..." : "Pausa el bot para contestar"}
                            className={`w-full p-4 pr-12 rounded-2xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none h-24 ${
                                !isPaused && inputText.length === 0 ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                            }`}
                        />
                        <button 
                            onClick={() => fileInputRef.current.click()}
                            className="absolute right-3 bottom-3 p-2 text-gray-400 hover:text-blue-600 transition"
                        >
                            <Paperclip size={20} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            multiple 
                            onChange={handleFileChange} 
                            className="hidden" 
                            accept="image/*,video/*"
                        />
                    </div>
                    <button 
                        onClick={handleSend}
                        disabled={(!inputText.trim() && selectedFiles.length === 0) || isSending}
                        className={`px-8 py-4 rounded-2xl font-bold flex flex-col items-center justify-center transition shadow-lg h-24 min-w-[100px] ${
                            (inputText.trim() || selectedFiles.length > 0) && !isSending ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        <Send size={24} />
                        <span className="text-[10px] mt-1 uppercase tracking-widest">Enviar</span>
                    </button>
                </div>
            </div>
            {/* Preview Asset / Lightbox */}
            {previewAsset && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
                    <button 
                        onClick={() => setPreviewAsset(null)}
                        className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors p-2 bg-white/10 rounded-full"
                    >
                        <X size={32} />
                    </button>
                    
                    <div className="max-w-4xl max-h-[80vh] relative group">
                        <img 
                            src={previewAsset.url} 
                            alt={previewAsset.name} 
                            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain ring-4 ring-white/10"
                        />
                        
                        <div className="absolute -bottom-12 left-0 right-0 flex justify-between items-center text-white px-2">
                            <span className="text-sm font-bold uppercase tracking-widest opacity-60">{previewAsset.name}</span>
                            <a 
                                href={previewAsset.url} 
                                download 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg"
                            >
                                <Download size={16} /> Descargar
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
