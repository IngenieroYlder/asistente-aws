import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useForm } from 'react-hook-form';
import { Trash2, Edit, Plus, X } from 'lucide-react';

export const UserManagement = ({ user }) => {
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const { register, handleSubmit, reset, setValue } = useForm();

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchUsers(); }, []);

    const onSubmit = async (data) => {
        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, data);
            } else {
                await api.post('/users', data);
            }
            setShowModal(false);
            setEditingUser(null);
            reset();
            fetchUsers();
        } catch (e) {
            alert('Error: ' + (e.response?.data?.message || 'Falló la operación'));
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que deseas eliminar este usuario?')) {
            try {
                await api.delete(`/users/${id}`);
                fetchUsers();
            } catch (e) { alert('Error al eliminar'); }
        }
    };

    const openEdit = (u) => {
        setEditingUser(u);
        setValue('username', u.username);
        setValue('email', u.email);
        setValue('role', u.role);
        setShowModal(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gestión de Equipo</h2>
                <button 
                    onClick={() => { setEditingUser(null); reset(); setShowModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                >
                    <Plus size={18} /> Nuevo Usuario
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Usuario</th>
                            <th className="p-4 font-semibold text-gray-600">Email</th>
                            <th className="p-4 font-semibold text-gray-600">Rol</th>
                            <th className="p-4 font-semibold text-gray-600">Empresa</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-medium">{u.username}</td>
                                <td className="p-4 text-gray-500">{u.email}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-800' : u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {u.role.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500">{u.Company ? u.Company.name : 'Global'}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => openEdit(u)} className="text-blue-500 hover:text-blue-700 mx-2"><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                            <button onClick={() => setShowModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-1">Nombre</label>
                                <input {...register('username')} className="w-full border p-2 rounded" required />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-1">Email</label>
                                <input {...register('email')} type="email" className="w-full border p-2 rounded" required />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-bold mb-1">Contraseña {editingUser && '(Dejar en blanco para no cambiar)'}</label>
                                <input {...register('password')} type="password" className="w-full border p-2 rounded" required={!editingUser} />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-bold mb-1">Rol</label>
                                <select {...register('role')} className="w-full border p-2 rounded">
                                    <option value="agent">Agente</option>
                                    <option value="admin">Administrador</option>
                                    {user.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                                </select>
                            </div>
                            <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Guardar</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
