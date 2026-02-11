import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useForm } from 'react-hook-form';
import { Building, Power, Plus, X, Calendar, Key, Eye, Users, Edit2, Lock } from 'lucide-react';
import { format } from 'date-fns';

export const CompanyManagement = () => {
    const [companies, setCompanies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [changingPassword, setChangingPassword] = useState(null);
    const [viewConfig, setViewConfig] = useState(null); 
    const { register, handleSubmit, reset, setValue } = useForm();

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/companies');
            setCompanies(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchCompanies(); }, []);

    const onSubmit = async (data) => {
        try {
            if (editingCompany) {
                await api.put(`/companies/${editingCompany.id}`, data);
                alert("Empresa actualizada exitosamente.");
            } else {
                await api.post('/companies', data);
                alert("Empresa creada exitosamente.");
            }
            setShowModal(false);
            setEditingCompany(null);
            reset();
            fetchCompanies();
        } catch (e) {
            alert('Error: ' + (e.response?.data?.message || 'Falló la operación'));
        }
    };

    const handleEdit = (company) => {
        setEditingCompany(company);
        reset();
        setValue('companyName', company.name);
        setValue('taxId', company.tax_id);
        setValue('phone', company.phone);
        setValue('city', company.city);
        setValue('address', company.address);
        setValue('website', company.website);
        setValue('industry', company.industry);
        setValue('timezone', company.timezone);
        setValue('maxSlots', company.max_slots);
        setShowModal(true);
    };

    const handlePasswordChange = async (data) => {
        if (!data.password) return;
        try {
            await api.post(`/companies/${changingPassword.id}/password`, { password: data.password });
            alert("Contraseña actualizada.");
            setChangingPassword(null);
            reset();
        } catch (e) { alert("Error al cambiar contraseña"); }
    };

    const toggleStatus = async (id) => {
        try {
            await api.put(`/companies/${id}/status`);
            fetchCompanies();
        } catch (e) { alert('Error al cambiar estado'); }
    };

    const addTime = async (id, days) => {
        if (!confirm(`¿Agregar ${days} días a esta empresa?`)) return;
        try {
            await api.post(`/companies/${id}/subscription`, { days });
            fetchCompanies();
            alert('Tiempo agregado.');
        } catch (e) { alert('Error al agregar tiempo'); }
    };

    const handleImpersonate = async (company) => {
        if (!confirm(`¿Entrar como administrador de ${company.name}?`)) return;
        try {
            const res = await api.post(`/auth/admin/impersonate/${company.id}`);
            localStorage.setItem('superAdminToken', localStorage.getItem('token'));
            localStorage.setItem('token', res.data.accessToken);
            localStorage.setItem('user', JSON.stringify({
                ...res.data,
                isImpersonating: true
            }));
            window.location.reload();
        } catch (e) {
            alert('Error al ingresar: ' + (e.response?.data?.message || e.message));
        }
    };

    const handleViewConfig = async (companyId) => {
        try {
            // FIX: Remove double /api prefix
            const res = await api.get(`/admin/companies/${companyId}/settings`);
            setViewConfig(res.data);
        } catch (e) {
            alert('Error al obtener configuración');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gestión de Empresas (SaaS)</h2>
                <button 
                    onClick={() => { setEditingCompany(null); reset(); setShowModal(true); }}
                    className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700"
                >
                    <Plus size={18} /> Nueva Empresa
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.map(c => (
                    <div key={c.id} className={`bg-white rounded-lg shadow p-6 border-l-4 ${c.is_active ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 truncate pr-2">{c.name}</h3>
                                <p className="text-sm text-gray-600 font-semibold">NIT: {c.tax_id || 'N/A'}</p>
                                <p className="text-sm text-gray-400 italic">Slug: {c.slug}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => handleEdit(c)} className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-200" title="Editar Datos">
                                    <Edit2 size={16} className="text-gray-600" />
                                </button>
                                <button onClick={() => setChangingPassword(c)} className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-200" title="Cambiar Contraseña">
                                    <Lock size={16} className="text-purple-600" />
                                </button>
                                <button onClick={() => handleViewConfig(c.id)} className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-200" title="Ver Configuración">
                                    <Eye size={16} className="text-blue-600" />
                                </button>
                                <button onClick={() => handleImpersonate(c)} className="p-1.5 bg-gray-50 rounded-full hover:bg-gray-200" title="Ingresar como Admin">
                                    <Key size={16} className="text-orange-600" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase">Detalles</h4>
                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded flex items-center gap-1">
                                    <Users size={12} /> Slots: {c.max_slots || 1}
                                </span>
                            </div>

                            <button 
                                onClick={() => toggleStatus(c.id)}
                                className={`w-full py-2 mb-2 rounded text-sm font-semibold flex items-center justify-center gap-2 ${c.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >
                                <Power size={16} /> {c.is_active ? 'Desactivar' : 'Activar'}
                            </button>

                            <div className="bg-gray-50 p-2 rounded text-center">
                                <p className="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1">
                                    <Calendar size={12} /> Vence: {c.subscription_end ? format(new Date(c.subscription_end), 'dd/MM/yyyy') : 'Indefinido'}
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button onClick={() => addTime(c.id, 7)} className="bg-blue-100 text-blue-700 text-xs py-1 rounded hover:bg-blue-200">+7 Días (Demo)</button>
                                    <button onClick={() => addTime(c.id, 30)} className="bg-purple-100 text-purple-700 text-xs py-1 rounded hover:bg-purple-200">+1 Mes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Config Modal */}
            {viewConfig && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Configuración del Cliente</h3>
                            <button onClick={() => setViewConfig(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="space-y-4">
                            {viewConfig.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 italic">Sin configuraciones personalizadas.</div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                <th className="p-3 font-bold">Clave</th>
                                                <th className="p-3 font-bold">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {viewConfig.map(s => (
                                                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="p-3 font-mono text-blue-600 whitespace-nowrap">{s.key}</td>
                                                    <td className="p-3 break-all text-gray-700">{s.value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {changingPassword && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">Cambiar Contraseña</h3>
                            <button onClick={() => setChangingPassword(null)}><X size={24} /></button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">Actualizando acceso para la cuenta administradora de: <strong className="text-gray-700">{changingPassword.name}</strong></p>
                        <form onSubmit={handleSubmit(handlePasswordChange)}>
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nueva Contraseña</label>
                                <input {...register('password')} type="password" placeholder="********" className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none border-gray-200" required />
                            </div>
                            <button className="w-full bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-100 font-bold">Actualizar Contraseña</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Create / Edit Company Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">{editingCompany ? 'Editar Empresa' : 'Registrar Nueva Empresa'}</h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Empresa</label>
                                    <input {...register('companyName')} className="w-full border p-2.5 rounded-xl outline-none border-gray-200" placeholder="Ej: Tienda de Zapatos" required />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">NIT / Cédula</label>
                                    <input {...register('taxId')} className="w-full border p-2.5 rounded-xl outline-none border-gray-200" placeholder="Ej: 900.123.456-7" />
                                </div>
                            </div>

                            <div className="mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Contacto & Ubicación</h4>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Teléfono</label>
                                        <input {...register('phone')} className="w-full border p-2 rounded-lg text-sm bg-white" placeholder="+57 300..." />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Ciudad</label>
                                        <input {...register('city')} className="w-full border p-2 rounded-lg text-sm bg-white" placeholder="Bogotá" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Dirección</label>
                                        <input {...register('address')} className="w-full border p-2 rounded-lg text-sm bg-white" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Sitio Web</label>
                                        <input {...register('website')} className="w-full border p-2 rounded-lg text-sm bg-white" placeholder="https://..." />
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 tracking-wider">Configuración de Cuenta (SaaS)</h4>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-700 mb-1">Industria</label>
                                        <select {...register('industry')} className="w-full border p-2 rounded-lg text-sm bg-white">
                                            <option value="technology">Tecnología / Software</option>
                                            <option value="retail">Retail / Comercio</option>
                                            <option value="restaurant">Restaurante / Comida</option>
                                            <option value="health">Salud / Medicina</option>
                                            <option value="services">Servicios Profesionales</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-blue-700 mb-1">Zona Horaria</label>
                                        <select {...register('timezone')} className="w-full border p-2 rounded-lg text-sm bg-white" defaultValue="America/Bogota">
                                            <option value="America/Bogota">America/Bogota (UTC-5)</option>
                                            <option value="America/Mexico_City">America/Mexico_City</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-700 mb-1">Slots (Conexiones Simultáneas)</label>
                                    <input {...register('maxSlots')} type="number" min="1" defaultValue="1" className="w-full border p-2 rounded-lg text-sm bg-white" />
                                </div>
                            </div>
                            
                            {!editingCompany && (
                                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 mb-6">
                                    <h4 className="text-sm font-bold text-purple-800 mb-3">Cuenta Administrador Inicial</h4>
                                    <div className="mb-3">
                                        <label className="block text-xs font-bold text-purple-700 mb-1">Correo Admin</label>
                                        <input {...register('adminEmail')} type="email" className="w-full border p-2 rounded-lg" placeholder="admin@empresa.com" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 mb-1">Contraseña</label>
                                        <input {...register('adminPassword')} type="password" iconclassName="w-full border p-2 rounded-lg" placeholder="********" required />
                                    </div>
                                </div>
                            )}

                            <button className="w-full bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-100 font-bold transition-all transform active:scale-[0.98]">
                                {editingCompany ? 'Guardar Cambios' : 'Crear Empresa'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
