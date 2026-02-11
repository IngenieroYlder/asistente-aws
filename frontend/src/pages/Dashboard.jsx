import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatList } from '../components/ChatList';
import { ChatView } from '../components/ChatView';
import { AssetManager } from '../components/AssetManager';
import { Settings } from '../components/Settings';
import { UserManagement } from '../components/UserManagement';
import { CompanyManagement } from '../components/CompanyManagement';
import { Reports } from '../components/Reports';

const Dashboard = () => {
    const [view, setView] = useState('chats'); 
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user'));
        setUser(u);
        
        // Apply Branding (Company or Global fallback if supported in future)
        const primaryColor = u?.company?.primary_color || '#3b82f6'; // Default blue
        document.documentElement.style.setProperty('--primary-color', primaryColor);
    }, []);

    if (!user) return <div>Cargando...</div>;

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar currentView={view} setView={setView} user={user} />
            
            {view === 'chats' && (
                <>
                    <div className="w-1/4 border-r bg-white flex flex-col">
                        <div className="p-4 border-b font-bold text-gray-700 flex justify-between items-center">
                            <span>Bandeja de Entrada</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{user.company ? user.company.name : 'SuperAdmin'}</span>
                        </div>
                        <ChatList onSelectSession={setSelectedSessionId} selectedSessionId={selectedSessionId} />
                    </div>
                    <div className="flex-1 bg-white">
                        {selectedSessionId ? (
                            <ChatView sessionId={selectedSessionId} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">Selecciona un chat</div>
                        )}
                    </div>
                </>
            )}

            {view === 'assets' && (
                <div className="flex-1 p-6 overflow-auto">
                    <AssetManager company={user.company} />
                </div>
            )}

            {view === 'team' && (
                <div className="flex-1 p-6 overflow-auto">
                    <UserManagement user={user} />
                </div>
            )}

            {view === 'companies' && (
                <div className="flex-1 p-6 overflow-auto">
                    <CompanyManagement />
                </div>
            )}

            {view === 'settings' && (
                <div className="flex-1 p-6 overflow-auto">
                    <Settings company={user.company} />
                </div>
            )}

            {view === 'reports' && (
                <div className="flex-1 overflow-auto bg-gray-50">
                    <Reports />
                </div>
            )}
        </div>
    );
};

export default Dashboard;
