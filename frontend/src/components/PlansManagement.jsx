import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Users, Cpu, DollarSign, Activity, CreditCard, Settings as SettingsIcon, X } from 'lucide-react';

export const PlansManagement = () => {
    const [companies, setCompanies] = useState([]);
    const [system, setSystem] = useState(null);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, plans
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [user] = useState(JSON.parse(localStorage.getItem('user')));

    // Form State
    const [formData, setFormData] = useState({
        name: '', price: 0, max_slots: 1, max_tokens: 1000000, features: '', description: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [overviewRes, plansRes] = await Promise.all([
                api.get('/admin/saas-overview'),
                api.get('/plans')
            ]);
            
            if (overviewRes.data.system) {
                setSystem(overviewRes.data.system);
                setCompanies(overviewRes.data.companies);
            } else {
                setCompanies(overviewRes.data);
            }
            setPlans(plansRes.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSavePlan = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                max_slots: parseInt(formData.max_slots),
                max_tokens: parseInt(formData.max_tokens),
                features: formData.features.split('\n').filter(f => f.trim()) // Convert text to array
            };

            if (editingPlan) {
                await api.put(`/plans/${editingPlan.id}`, payload);
            } else {
                await api.post('/plans', payload);
            }
            setShowModal(false);
            setEditingPlan(null);
            fetchData();
        } catch (error) {
            console.error(error);
            alert('Error al guardar el plan');
        }
    };

    const handleDeletePlan = async (id) => {
        if (!window.confirm('¿Eliminar este plan?')) return;
        try {
            await api.delete(`/plans/${id}`);
            fetchData();
        } catch (e) {
            alert(e.response?.data?.message || 'Error al eliminar');
        }
    };

    const openModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            setFormData({
                name: plan.name,
                price: plan.price,
                max_slots: plan.max_slots,
                max_tokens: plan.max_tokens,
                features: (plan.features || []).join('\n'),
                description: plan.description || ''
            });
        } else {
            setEditingPlan(null);
            setFormData({ name: '', price: 0, max_slots: 1, max_tokens: 1000000, features: '', description: '' });
        }
        setShowModal(true);
    };

    if (loading) return <div className="p-6">Cargando...</div>;

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <CreditCard /> SaaS Management
            </h2>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={`pb-2 px-4 ${activeTab === 'overview' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500'}`}
                >
                    Resumen y Consumo
                </button>
                <button 
                    onClick={() => setActiveTab('plans')}
                    className={`pb-2 px-4 ${activeTab === 'plans' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-gray-500'}`}
                >
                    Gestionar Planes
                </button>
            </div>

            {activeTab === 'overview' ? (
                <>
                    {/* System Health Section */}
                    {system && (
                        <div className="mb-8 bg-gray-900 text-white p-6 rounded-2xl shadow-lg">
                            <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2">
                                <Activity size={16} /> Estado del Servidor
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                <div>
                                    <div className="text-2xl font-mono">{system.total_mem_gb} GB</div>
                                    <div className="text-xs text-gray-500">RAM Total</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-mono text-purple-400">{system.used_mem_gb} GB</div>
                                    <div className="text-xs text-gray-500">RAM Usada</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-mono text-green-400">{system.free_mem_gb} GB</div>
                                    <div className="text-xs text-gray-500">RAM Libre</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-mono">{system.cpus}</div>
                                    <div className="text-xs text-gray-500">Cores CPU</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-mono">{system.load[0]?.toFixed(2)}</div>
                                    <div className="text-xs text-gray-500">Carga (1m)</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <h3 className="text-gray-500 text-sm font-bold uppercase">Total Empresas</h3>
                            <p className="text-2xl font-bold">{companies.length}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
                            <h3 className="text-gray-500 text-sm font-bold uppercase">Sesiones Activas</h3>
                            <p className="text-2xl font-bold">{companies.reduce((a, b) => a + b.active_sessions, 0)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
                            <h3 className="text-gray-500 text-sm font-bold uppercase">Tokens Consumidos</h3>
                            <p className="text-2xl font-bold">{companies.reduce((a, b) => a + b.total_tokens, 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
                            <h3 className="text-gray-500 text-sm font-bold uppercase">Costo Est. (USD)</h3>
                            <p className="text-2xl font-bold">${companies.reduce((a, b) => a + parseFloat(b.total_cost), 0).toFixed(4)}</p>
                        </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 uppercase">
                                <tr>
                                    <th className="p-4">Empresa</th>
                                    <th className="p-4">Estado Plan</th>
                                    <th className="p-4">Conexiones</th>
                                    <th className="p-4">Recursos (Est.)</th>
                                    <th className="p-4">Consumo Tokens (Mes/Día)</th>
                                    <th className="p-4">Costo Est.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map(c => (
                                    <tr key={c.id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{c.name}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${c.plan_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {c.plan_status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Activity size={16} className={c.active_sessions >= c.max_slots ? "text-red-500" : "text-green-500"} />
                                                <span>{c.active_sessions} / {c.max_slots}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col text-xs font-mono text-gray-500">
                                                <div title="Almacenamiento en Disco">💾 {c.disk_usage_mb} MB</div>
                                                <div title="Uso Estimado de RAM">🧠 ~{c.est_ram_mb} MB</div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-xs">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-bold text-lg text-purple-700">{c.usage_period?.month.toLocaleString()} <span className="text-gray-400 text-[10px] uppercase">/ Mes</span></div>
                                                <div className="text-gray-500">Día: {c.usage_period?.day.toLocaleString()}</div>
                                                <div className="text-gray-500">Sem: {c.usage_period?.week.toLocaleString()}</div>
                                                <div className="text-gray-400 pt-1 border-t mt-1">Total: {c.total_tokens.toLocaleString()}</div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-mono text-green-600">
                                            ${c.total_cost}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">* Costos de Token basados en uso. Memoria RAM es un estimado basado en sesiones activas.</p>
                </>
            ) : (
                /* PLAN MANAGEMENT TAB */
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold">Planes Disponibles</h3>
                        <button onClick={() => openModal()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            + Crear Plan
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(plans || []).map(plan => (
                            <div key={plan.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-800">{plan.name}</h4>
                                        <div className="text-2xl font-bold text-blue-600 mt-1">
                                            ${plan.price} <span className="text-sm text-gray-500 font-normal">/ {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(plan)} className="text-gray-400 hover:text-blue-500"><SettingsIcon size={18}/></button>
                                        <button onClick={() => handleDeletePlan(plan.id)} className="text-gray-400 hover:text-red-500"><X size={18}/></button>
                                    </div>
                                </div>
                                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                                
                                <div className="space-y-2 mb-6 flex-1">
                                    <div className="flex justify-between text-sm border-b pb-1">
                                        <span className="text-gray-500">Slots (Conexiones)</span>
                                        <span className="font-bold">{plan.max_slots}</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-b pb-1">
                                        <span className="text-gray-500">Tokens Mensuales</span>
                                        <span className="font-bold">{plan.max_tokens.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 space-y-1">
                                    {plan.features && plan.features.map((f, i) => (
                                        <div key={i}>• {f}</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Create/Edit Plan */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                        <h3 className="text-xl font-bold mb-4">{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</h3>
                        <form onSubmit={handleSavePlan} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Nombre del Plan</label>
                                <input type="text" required className="w-full border rounded p-2" 
                                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Precio (USD)</label>
                                    <input type="number" step="0.01" required className="w-full border rounded p-2" 
                                        value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Ciclo</label>
                                    <select className="w-full border rounded p-2" value={formData.billing_cycle || 'monthly'} onChange={e => setFormData({...formData, billing_cycle: e.target.value})}>
                                        <option value="monthly">Mensual</option>
                                        <option value="yearly">Anual</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Max Slots</label>
                                    <input type="number" required className="w-full border rounded p-2" 
                                        value={formData.max_slots} onChange={e => setFormData({...formData, max_slots: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Max Tokens</label>
                                    <input type="number" required className="w-full border rounded p-2" 
                                        value={formData.max_tokens} onChange={e => setFormData({...formData, max_tokens: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Descripción Corta</label>
                                <input type="text" className="w-full border rounded p-2" 
                                    value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Características (una por línea)</label>
                                <textarea className="w-full border rounded p-2 h-24" 
                                    value={formData.features} onChange={e => setFormData({...formData, features: e.target.value})} 
                                    placeholder="Soporte 24/7&#10;Acceso a API&#10;Reportes Avanzados"    
                                ></textarea>
                            </div>
                            
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
