import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { BarChart, Calendar, MessageSquare, ArrowUpRight, ArrowDownLeft, Filter } from 'lucide-react';

export const Reports = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState('week'); // day, week, month, year
    const [platform, setPlatform] = useState(''); // '' = all
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));

    useEffect(() => {
        // Fetch companies if superadmin
        if (user && user.role === 'superadmin') {
            api.get('/companies').then(res => setCompanies(res.data)).catch(console.error);
        }
    }, [user]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = { period, platform };
            if (selectedCompany) params.companyId = selectedCompany;
            
            const res = await api.get('/reports/stats', { params });
            setStats(res.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStats();
    }, [period, platform, selectedCompany]);

    if (!stats) return <div className="p-10 text-center">Cargando Reportes...</div>;

    // Helper for CSS Chart
    const dates = Object.keys(stats.by_date).sort();
    const maxVal = Math.max(
        ...dates.map(d => Math.max(stats.by_date[d].incoming, stats.by_date[d].outgoing)),
        1 // prevent divide by zero
    );

    return (
        <div className="p-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                        <BarChart className="text-purple-600" /> Reportes y Métricas
                    </h2>
                    <p className="text-gray-400 text-sm">Analiza el rendimiento de tu asistente IA.</p>
                </div>
                
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100 items-center">
                    {/* Company Filter (SuperAdmin Only) */}
                    {user?.role === 'superadmin' && (
                        <>
                            <select 
                                className="bg-transparent text-sm font-bold text-gray-600 p-2 outline-none cursor-pointer max-w-[150px]"
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                            >
                                <option value="">Global (Todas)</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <div className="w-px bg-gray-200 my-1 h-6"></div>
                        </>
                    )}

                    <select 
                        className="bg-transparent text-sm font-bold text-gray-600 p-2 outline-none cursor-pointer"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                    >
                        <option value="day">Hoy</option>
                        <option value="week">Última Semana</option>
                        <option value="month">Último Mes</option>
                        <option value="year">Último Año</option>
                    </select>
                    <div className="w-px bg-gray-200 my-1"></div>
                    <select 
                        className="bg-transparent text-sm font-bold text-gray-600 p-2 outline-none cursor-pointer uppercase"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                    >
                        <option value="">Todas las Redes</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telegram">Telegram</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Messenger</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-800">
                            {stats.total_incoming + stats.total_outgoing}
                        </div>
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Mensajes</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-green-50 text-green-600 rounded-2xl">
                        <ArrowDownLeft size={24} />
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-800">
                            {stats.total_incoming}
                        </div>
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Recibidos (Usuarios)</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-800">
                            {stats.total_outgoing}
                        </div>
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Respondidos (IA)</div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Main Bar Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" /> Actividad Temporal
                    </h3>
                    
                    {dates.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-gray-300 italic">No hay datos en este periodo</div>
                    ) : (
                        <div className="flex items-end justify-between h-64 gap-2 pt-4">
                            {dates.map(date => {
                                const incom = stats.by_date[date].incoming;
                                const out = stats.by_date[date].outgoing;
                                const total = incom + out;
                                const percent = (total / maxVal) * 100;
                                
                                return (
                                    <div key={date} className="flex-1 flex flex-col items-center group relative cursor-help">
                                        <div className="w-full max-w-[40px] flex flex-col-reverse h-full bg-gray-50 rounded-t-lg overflow-hidden relative">
                                            {/* Tooltip */}
                                            <div className="hidden group-hover:block absolute bottom-full mb-2 bg-black text-white text-[10px] p-2 rounded pointer-events-none z-10 w-max">
                                                <div className="font-bold">{date}</div>
                                                <div>Recibidos: {incom}</div>
                                                <div>Enviados: {out}</div>
                                            </div>

                                            {/* Bars */}
                                            <div 
                                                style={{ height: `${(out / maxVal) * 100}%` }} 
                                                className="w-full bg-purple-500 opacity-80 hover:opacity-100 transition-all duration-500 rounded-t-sm"
                                            ></div>
                                            <div 
                                                style={{ height: `${(incom / maxVal) * 100}%` }} 
                                                className="w-full bg-green-500 opacity-80 hover:opacity-100 transition-all duration-500 rounded-t-sm"
                                            ></div>
                                        </div>
                                        <div className="mt-2 text-[10px] text-gray-400 font-mono rotate-45 origin-left truncate w-10">
                                            {date.substring(5)} {/* show MM-DD */}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Platform Distribution */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Canales</h3>
                    <div className="space-y-4">
                        {Object.keys(stats.by_platform).length === 0 ? (
                            <div className="text-gray-300 italic text-center text-sm">Sin actividad</div>
                        ) : (
                            Object.keys(stats.by_platform).map(p => {
                                const pStats = stats.by_platform[p];
                                const pTotal = pStats.incoming + pStats.outgoing;
                                const totalMsgs = stats.total_incoming + stats.total_outgoing;
                                const percent = Math.round((pTotal / totalMsgs) * 100);

                                return (
                                    <div key={p}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold uppercase text-gray-600">{p}</span>
                                            <span className="text-xs font-bold text-gray-400">{percent}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                style={{ width: `${percent}%` }} 
                                                className={`h-full rounded-full ${
                                                    p === 'whatsapp' ? 'bg-green-500' : 
                                                    p === 'telegram' ? 'bg-blue-400' : 
                                                    p === 'instagram' ? 'bg-pink-500' : 
                                                    'bg-blue-600'
                                                }`}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-1 text-[9px] text-gray-400">
                                            <span>R: {pStats.incoming}</span>
                                            <span>E: {pStats.outgoing}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
