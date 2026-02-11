import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);

  const onSubmit = async (data) => {
    try {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const res = await api.post(endpoint, data);
      
      if (res.data.accessToken) {
          localStorage.setItem('token', res.data.accessToken);
          localStorage.setItem('user', JSON.stringify({
              username: res.data.username,
              role: res.data.role,
              company: res.data.company,
              globalBranding: res.data.globalBranding // Added this
          }));
          navigate('/dashboard');
      } else if (isRegistering) {
          alert('Registro exitoso. Por favor inicia sesión.');
          setIsRegistering(false);
      }
    } catch (e) {
        console.error(e);
        if (e.response && e.response.status === 404) {
            alert('Error: Correo no registrado. Verifica que esté bien escrito.');
        } else if (e.response && e.response.status === 401) {
            alert('Error: Contraseña incorrecta.');
        } else {
            alert('Error: ' + (e.response?.data?.message || 'Error de conexión'));
        }
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm bg-white p-8 rounded shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
            {isRegistering ? 'Crear Cuenta Empresa' : 'Iniciar Sesión'}
        </h2>
        
        {isRegistering && (
             <div className="mb-4">
               <label className="block mb-2 text-sm font-bold text-gray-700">Nombre de Usuario</label>
               <input {...register('username')} className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required />
             </div>
        )}

        <div className="mb-4">
          <label className="block mb-2 text-sm font-bold text-gray-700">Correo Electrónico</label>
          <input type="email" {...register('email')} className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        
        <div className="mb-6">
          <label className="block mb-2 text-sm font-bold text-gray-700">Contraseña</label>
          <input type="password" {...register('password')} className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>

        {isRegistering && (
             <div className="mb-6">
                <label className="block mb-2 text-sm font-bold text-gray-700">Nombre de Empresa</label>
                <input {...register('companyName')} className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
        )}

        <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition duration-200">
            {isRegistering ? 'Registrar' : 'Entrar'}
        </button>
        
        <div className="mt-4 text-center">
            <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-blue-500 hover:underline"
            >
                {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres nuevo? Crea tu empresa'}
            </button>
        </div>
      </form>
    </div>
  );
};

export default Login;
