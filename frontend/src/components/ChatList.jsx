import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { format } from 'date-fns';
import { formatTime } from '../utils/dateUtils';

import { Filter, Send, MessageCircle, Smartphone, Camera, Pause, Play } from 'lucide-react';

export const ChatList = ({ onSelectSession, selectedSessionId }) => {
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter] = useState('all');
    const [selectedIds, setSelectedIds] = useState([]);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions');
            setSessions(res.data);
        } catch (e) {
            console.error("Error fetching sessions", e);
        }
    };

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 5000); 
        return () => clearInterval(interval);
    }, []);

    const isBotPaused = (s) => s.Contact.bot_paused_until && new Date(s.Contact.bot_paused_until) > new Date();

    const filteredSessions = sessions.filter(s => {
        if (filter === 'all') return true;
        if (filter === 'paused') return isBotPaused(s);
        return s.Contact.platform === filter;
    });

    const platforms = [
        { id: 'all', label: 'Todos', icon: <Filter size={14}/> },
        { id: 'paused', label: 'Pausados', icon: <Pause size={14} className="text-orange-500"/> },
        { id: 'telegram', label: 'Telegram', icon: <Smartphone size={14}/> },
        { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={14}/> },
        { id: 'instagram', label: 'Instagram', icon: <Camera size={14}/> },
        { id: 'messenger', label: 'Messenger', icon: <Send size={14}/> },
    ];

    const toggleSelect = (e, contactId) => {
        e.stopPropagation();
        setSelectedIds(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]);
    };

    const handleBulkResume = async () => {
        if (!window.confirm(`¿Reactivar bot para ${selectedIds.length} contactos?`)) return;
        try {
            await api.post('/bulk-resume', { contactIds: selectedIds });
            setSelectedIds([]);
            fetchSessions();
        } catch (e) { alert("Error en acción masiva"); }
    };

    const togglePin = async (e, sessionId) => {
        e.stopPropagation();
        try {
            await api.patch(`/sessions/${sessionId}/pin`);
            fetchSessions();
        } catch (e) { console.error("Error pinning session", e); }
    };

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            <div className="p-4 border-b">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Chats</h3>
                <div className="flex flex-wrap gap-2">
                    {platforms.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { setFilter(p.id); setSelectedIds([]); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                filter === p.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {p.icon}
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {filteredSessions.length === 0 && (
                    <div className="p-10 text-center text-gray-400 text-sm italic">
                        No hay {filter === 'paused' ? 'chats pausados' : 'chats en esta categoría'}.
                    </div>
                )}
                {filteredSessions.map(session => (
                    <div 
                        key={session.id}
                        onClick={() => onSelectSession(session.id)}
                        className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-all border-l-4 flex gap-3 items-center ${
                            selectedSessionId === session.id 
                            ? 'bg-blue-50 border-blue-600' 
                            : 'border-transparent'
                        } ${session.is_pinned ? 'bg-yellow-50/30' : ''}`}
                    >
                        <input 
                            type="checkbox" 
                            checked={selectedIds.includes(session.Contact.id)}
                            onChange={(e) => toggleSelect(e, session.Contact.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2 truncate">
                                    <span className={`font-semibold truncate ${selectedSessionId === session.id ? 'text-blue-700' : 'text-gray-800'}`}>
                                        {session.Contact.first_name} 
                                    </span>
                                    {session.is_pinned && <Filter size={10} className="text-blue-600 rotate-45" fill="currentColor" />}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {isBotPaused(session) && <Pause size={10} className="text-orange-500" />}
                                    <button 
                                        onClick={(e) => togglePin(e, session.id)}
                                        className={`transition-colors ${session.is_pinned ? 'text-blue-600' : 'text-gray-300 hover:text-blue-400'}`}
                                        title={session.is_pinned ? "Desanclar" : "Anclar"}
                                    >
                                        <Filter size={12} className={session.is_pinned ? 'rotate-45' : ''} />
                                    </button>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded">
                                        {session.Contact.platform}
                                    </span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-xs text-gray-500 truncate mr-4">
                                    {isBotPaused(session) ? 'Modo Humano' : 'Bot Activo'}
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium lowercase">
                                     {formatTime(session.updatedAt)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 bg-gray-900 text-white p-3 rounded-xl shadow-2xl flex justify-between items-center animate-in slide-in-from-bottom-5">
                    <span className="text-xs font-bold">{selectedIds.length} seleccionados</span>
                    <button 
                        onClick={handleBulkResume}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
                    >
                        <Play size={12} fill="currentColor"/>
                        Reanudar Bot
                    </button>
                    <button 
                        onClick={() => setSelectedIds([])}
                        className="text-gray-400 hover:text-white transition"
                    >
                        <span className="text-[10px] uppercase font-bold">Cancelar</span>
                    </button>
                </div>
            )}
        </div>
    );
};
