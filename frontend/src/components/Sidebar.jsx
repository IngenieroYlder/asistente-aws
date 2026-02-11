import React, { useState } from 'react';
import { MessageSquare, Image, Settings as SettingsIcon, LogOut, Users, Building, X, BarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../utils/api';

export const Sidebar = ({ currentView, setView, user }) => {
    const navigate = useNavigate();
    const [showLogoLightbox, setShowLogoLightbox] = useState(false);
    
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const logoUrl = user.company && user.company.logo_url 
        ? `${BASE_URL}/${user.company.logo_url}` 
        : user.globalBranding && user.globalBranding.logo 
            ? `${BASE_URL}/${user.globalBranding.logo}` 
            : null;

    const navItem = (id, icon, label) => (
        <button 
            onClick={() => setView(id)}
            className={`flex flex-col items-center justify-center p-4 w-full hover:bg-gray-800 transition ${currentView === id ? 'bg-gray-800 text-blue-400' : 'text-gray-400'}`}
        >
            {icon}
            <span className="text-xs mt-1">{label}</span>
        </button>
    );

    return (
        <>
            <div className="w-20 bg-gray-900 flex flex-col items-center py-4 text-white">
                <div 
                    onClick={() => logoUrl && setShowLogoLightbox(true)}
                    className={`mb-8 font-bold text-xl flex items-center justify-center h-12 w-12 bg-white rounded-full text-gray-900 overflow-hidden shadow-lg border-2 border-white/20 ${logoUrl ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all' : ''}`}
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                        "🤖"
                    )}
                </div>
                
                {navItem('chats', <MessageSquare />, 'Chats')}
                {navItem('assets', <Image />, 'Archivos')}
                {navItem('reports', <BarChart />, 'Rep.')}
                
                {/* Superadmin sees Companies, Admins see Team */}
                {user.role === 'superadmin' ? (
                     <>
                        {navItem('companies', <Building />, 'Empresas')}
                        {navItem('plans', <Users />, 'Planes')} {/* New Plans View */}
                     </>
                ) : (
                     navItem('team', <Users />, 'Equipo')
                )}

                {navItem('settings', <SettingsIcon />, 'Ajustes')}
                
                <div className="mt-auto flex flex-col items-center gap-2">
                    {/* Return to SuperAdmin Button */}
                    {localStorage.getItem('superAdminToken') && (
                        <button 
                            onClick={() => {
                                const originalToken = localStorage.getItem('superAdminToken');
                                localStorage.setItem('token', originalToken);
                                localStorage.removeItem('superAdminToken');
                                // Determine user from token (or just reload and let app fetch profile)
                                // Simplified: Just reload, App will refetch user profile
                                window.location.reload(); 
                            }}
                            className="p-2 bg-red-600 rounded-full text-white hover:bg-red-700 transition animate-pulse"
                            title="Volver a SuperAdmin"
                        >
                            <LogOut size={16} className="rotate-180" />
                        </button>
                    )}

                    <button onClick={logout} className="p-4 text-gray-500 hover:text-red-400">
                        <LogOut />
                    </button>
                </div>
            </div>

            {/* Logo Lightbox */}
            {showLogoLightbox && logoUrl && (
                <div 
                    className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-8 backdrop-blur-sm"
                    onClick={() => setShowLogoLightbox(false)}
                >
                    <div className="relative max-w-lg max-h-[80vh] bg-white rounded-3xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setShowLogoLightbox(false)}
                            className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-all"
                        >
                            <X size={20} />
                        </button>
                        <img src={logoUrl} alt="Logo Grande" className="max-w-full max-h-[70vh] object-contain mx-auto rounded-xl" />
                    </div>
                </div>
            )}
        </>
    );
};
