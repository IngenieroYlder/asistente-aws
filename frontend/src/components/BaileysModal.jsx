import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api, { BASE_URL } from '../utils/api';
import { X, Wifi, WifiOff, Smartphone, AlertTriangle, Shield, CheckCircle } from 'lucide-react';

const STATUS_MAP = {
    disconnected: { label: 'Desconectado', color: '#EF4444', icon: WifiOff },
    connecting: { label: 'Conectando...', color: '#F59E0B', icon: Wifi },
    reconnecting: { label: 'Reconectando...', color: '#F59E0B', icon: Wifi },
    qr: { label: 'Escanea el QR', color: '#3B82F6', icon: Smartphone },
    connected: { label: 'Conectado', color: '#10B981', icon: CheckCircle },
    logged_out: { label: 'Sesión Cerrada', color: '#6B7280', icon: WifiOff }
};

export default function BaileysModal({ isOpen, onClose, companyId }) {
    const [status, setStatus] = useState('disconnected');
    const [qr, setQR] = useState(null);
    const [phone, setPhone] = useState(null);
    const [name, setName] = useState(null);
    const [accepted, setAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [qrTimer, setQrTimer] = useState(0);
    const socketRef = useRef(null);
    const timerRef = useRef(null);

    const companyKey = companyId ? `company_${companyId}` : 'global';

    // Socket.IO for real-time QR and status
    useEffect(() => {
        if (!isOpen) return;

        const socketUrl = BASE_URL.replace('/api', '').replace(/\/$/, '');
        const socket = io(socketUrl, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on(`baileys:${companyKey}`, (data) => {
            setStatus(data.status);
            if (data.qr) {
                setQR(data.qr);
                // Reset countdown on new QR (Baileys QR cycles every ~20s)
                setQrTimer(20);
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    setQrTimer(prev => {
                        if (prev <= 1) {
                            clearInterval(timerRef.current);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                setQR(null);
                setQrTimer(0);
                if (timerRef.current) clearInterval(timerRef.current);
            }
            if (data.phone) setPhone(data.phone);
            if (data.name) setName(data.name);
        });

        // Fetch current status on open
        fetchStatus();

        return () => {
            socket.disconnect();
            socketRef.current = null;
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isOpen, companyKey]);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/baileys/status');
            setStatus(data.status || 'disconnected');
            if (data.qr) setQR(data.qr);
            if (data.phone) setPhone(data.phone);
            if (data.name) setName(data.name);
        } catch(e) {}
    };

    const startConnection = async () => {
        setLoading(true);
        setError(null);
        try {
            await api.post('/baileys/start');
            setStatus('connecting');
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        }
        setLoading(false);
    };

    const stopConnection = async () => {
        setLoading(true);
        try {
            await api.post('/baileys/stop');
            setStatus('disconnected');
            setQR(null);
            setPhone(null);
            setName(null);
        } catch(e) {}
        setLoading(false);
    };

    if (!isOpen) return null;
    
    const statusInfo = STATUS_MAP[status] || STATUS_MAP.disconnected;
    const StatusIcon = statusInfo.icon;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-t-3xl text-white relative">
                    <button onClick={onClose} className="absolute top-4 right-4 p-1 bg-white/20 rounded-full hover:bg-white/30 transition">
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🧪</div>
                        <div>
                            <h3 className="text-lg font-bold">WhatsApp - Modo Prueba</h3>
                            <p className="text-green-200 text-xs">Conexión vía Baileys (No Oficial)</p>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusInfo.color }}></div>
                        <StatusIcon size={14} />
                        <span className="text-xs font-medium">{statusInfo.label}</span>
                        {phone && <span className="text-xs opacity-80 ml-2">+{phone} {name ? `(${name})` : ''}</span>}
                    </div>
                </div>

                <div className="p-6">
                    {/* Disclaimer - only show when disconnected */}
                    {(status === 'disconnected' || status === 'logged_out') && !accepted && (
                        <div className="mb-6">
                            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
                                <div className="flex items-start gap-3 mb-4">
                                    <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={22} />
                                    <div>
                                        <h4 className="font-bold text-amber-800 text-sm">MODO DE PRUEBA - WhatsApp No Oficial</h4>
                                        <p className="text-amber-700 text-xs mt-1">
                                            Este modo utiliza el protocolo de WhatsApp Web (Baileys) para pruebas rápidas. 
                                            <strong> NO</strong> es el API oficial de Meta.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl p-4 mb-4 border border-amber-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="text-green-600" size={16} />
                                        <h5 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Para evitar baneos:</h5>
                                    </div>
                                    <ol className="space-y-2 text-xs text-gray-600">
                                        <li className="flex items-start gap-2">
                                            <span className="bg-green-100 text-green-700 font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">1</span>
                                            <span>Use un <strong>número dedicado a pruebas</strong> (no su número personal)</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="bg-green-100 text-green-700 font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">2</span>
                                            <span><strong>No envíe mensajes masivos</strong> ni spam bajo ningún concepto</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="bg-green-100 text-green-700 font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">3</span>
                                            <span>No agregue contactos desconocidos automáticamente</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="bg-green-100 text-green-700 font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">4</span>
                                            <span>Limite las pruebas a <strong>pocas conversaciones</strong></span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="bg-green-100 text-green-700 font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]">5</span>
                                            <span><strong>Desconecte cuando no esté probando</strong> activamente</span>
                                        </li>
                                    </ol>
                                </div>

                                <div className="bg-red-50 rounded-xl p-4 border border-red-200 mb-4">
                                    <p className="text-xs text-red-700 font-medium">
                                        ❌ <strong>DESCARGO DE RESPONSABILIDAD:</strong> No nos hacemos responsables por suspensiones, 
                                        bloqueos o pérdida del número de WhatsApp derivados del uso de este modo. 
                                        Al activar, usted acepta estos términos y entiende los riesgos.
                                    </p>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={accepted}
                                        onChange={(e) => setAccepted(e.target.checked)}
                                        className="w-5 h-5 rounded border-2 border-amber-400 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-xs font-bold text-gray-700">
                                        Acepto los términos y entiendo los riesgos
                                    </span>
                                </label>
                            </div>

                            <button 
                                onClick={startConnection}
                                disabled={!accepted || loading}
                                className="w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl"
                            >
                                {loading ? '⏳ Conectando...' : '🔗 Activar Modo Prueba'}
                            </button>
                        </div>
                    )}

                    {/* Accepted but disconnected - show start button */}
                    {(status === 'disconnected' || status === 'logged_out') && accepted && (
                        <div className="text-center py-4">
                            <button 
                                onClick={startConnection}
                                disabled={loading}
                                className="w-full py-3 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 shadow-lg transition-all disabled:opacity-50"
                            >
                                {loading ? '⏳ Conectando...' : '🔗 Iniciar Conexión'}
                            </button>
                        </div>
                    )}

                    {/* QR Code Display */}
                    {status === 'qr' && qr && (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500 mb-4">
                                📱 Abre <strong>WhatsApp</strong> → Menú (⋮) → <strong>Dispositivos Vinculados</strong> → <strong>Vincular Dispositivo</strong>
                            </p>
                            <div className="relative inline-block">
                                <div className="p-4 bg-white rounded-2xl shadow-lg border-2 border-green-200">
                                    <img src={qr} alt="QR Code" className="w-64 h-64" />
                                </div>
                                {/* Countdown ring */}
                                <div className="absolute -top-3 -right-3 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-100">
                                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                                        <circle
                                            cx="18" cy="18" r="15" fill="none"
                                            stroke={qrTimer > 5 ? '#10B981' : '#EF4444'}
                                            strokeWidth="3"
                                            strokeDasharray={`${(qrTimer / 20) * 94.25} 94.25`}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
                                        />
                                    </svg>
                                    <span className={`absolute text-xs font-bold ${qrTimer > 5 ? 'text-green-600' : 'text-red-500'}`}>
                                        {qrTimer}s
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3">
                                ⏳ Nuevo QR en <strong className={qrTimer > 5 ? 'text-green-600' : 'text-red-500'}>{qrTimer}s</strong> — Escanea rápido, no esperes a que cambie.
                            </p>
                            <p className="text-[10px] text-gray-300 mt-1">
                                Tip: Si el teléfono dice "Iniciando sesión" pero no conecta, espera al siguiente QR e intenta de nuevo.
                            </p>
                        </div>
                    )}

                    {/* Connecting / Reconnecting State */}
                    {(status === 'connecting' || status === 'reconnecting') && !qr && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm text-gray-500">
                                {status === 'reconnecting' ? 'Reconectando, espera...' : 'Preparando conexión...'}
                            </p>
                        </div>
                    )}

                    {/* Connected State */}
                    {status === 'connected' && (
                        <div className="text-center py-6">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-green-600" size={40} />
                            </div>
                            <h4 className="text-lg font-bold text-gray-800">¡Conectado!</h4>
                            <p className="text-sm text-gray-500 mt-1">
                                +{phone} {name ? `(${name})` : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                                El bot ahora responde mensajes de WhatsApp en esta línea.
                            </p>
                            
                            <button 
                                onClick={stopConnection}
                                disabled={loading}
                                className="mt-6 px-8 py-2.5 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 shadow transition-all disabled:opacity-50"
                            >
                                🔌 Desconectar
                            </button>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-200">
                            ❌ {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
