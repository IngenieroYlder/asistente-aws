import React, { useEffect, useState, useRef } from 'react';
import api, { BASE_URL } from '../utils/api';
import { Save, Image as ImageIcon, Copy, Plus, X, Upload, Download, History, RefreshCcw, Smartphone, MessageCircle, Send, Trash2, Eye, Edit2 } from 'lucide-react';
import BaileysModal from './BaileysModal';

export const Settings = ({ company }) => {
    const [settings, setSettings] = useState([]);
    const [assets, setAssets] = useState([]);
    const [showWebhookHelp, setShowWebhookHelp] = useState(false);
    const [knowledgeAssets, setKnowledgeAssets] = useState([]);
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [showBrandingGallery, setShowBrandingGallery] = useState(false);
    const [brandingTarget, setBrandingTarget] = useState(null); // { type: 'logo'|'icon'|'favicon' }
    const [activePromptKey, setActivePromptKey] = useState('SYSTEM_PROMPT'); // Toggle between platforms
    const [previewAsset, setPreviewAsset] = useState(null); // Asset for content preview
    const [webhookUrl, setWebhookUrl] = useState('');
    const [showBaileysModal, setShowBaileysModal] = useState(false);

    useEffect(() => {
        const savedUrl = settings.find(s => s.key === 'META_WEBHOOK_URL')?.value;
        setWebhookUrl(savedUrl || `${window.location.origin}/webhooks/meta/${company?.id || 'global'}`);
    }, [company, settings]);
    
    const textareaRef = useRef(null);
    const knowledgeInputRef = useRef(null);

    const fetchData = async () => {
        try {
            const [settingsRes, assetsRes, backupsRes, knowledgeRes] = await Promise.all([
                api.get('/settings'),
                api.get('/assets'),
                api.get('/backups'),
                api.get('/assets', { params: { isKnowledge: true } })
            ]);
            setSettings(settingsRes.data);
            setAssets(assetsRes.data);
            setBackups(backupsRes.data);
            setKnowledgeAssets(knowledgeRes.data);
        } catch (e) { console.error(e); }
    };

    const updateLocalBranding = (type, data) => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return;
        
        if (user.company && data.company) {
            user.company = data.company;
        } else if (data.setting) {
            user.globalBranding = { 
                ...user.globalBranding,
                [type]: data.setting.value 
            };
        }
        localStorage.setItem('user', JSON.stringify(user));
    };

    useEffect(() => { fetchData(); }, []);

    const handleChange = (key, value) => {
        const newSettings = [...settings];
        const idx = newSettings.findIndex(s => s.key === key);
        if (idx >= 0) {
            newSettings[idx].value = value;
            setSettings(newSettings);
        } else {
             setSettings([...settings, { key, value }]);
        }
    };

    const saveSetting = async (key, explicitValue = undefined) => {
        let value;
        if (explicitValue !== undefined) {
            value = explicitValue;
        } else {
            const s = settings.find(i => i.key === key);
            value = s ? s.value : '';
        }
        
        setLoading(true);
        try {
            await api.post('/settings', { key, value });
            alert('¡Guardado!');
            fetchData();
        } catch(e) { 
            console.error(e);
            alert(`Error al guardar: ${e.response?.data?.error || e.message}`); 
        }
        setLoading(false);
    };

    const createBackup = async () => {
        setLoading(true);
        try {
            await api.post('/backups');
            fetchData();
            alert('Backup creado (Máximo 3)');
        } catch (e) { alert('Error al respaldar'); }
        setLoading(false);
    };

    const restoreBackup = async (id) => {
        if (!confirm('¿Restaurar configuración? Sobrescribirá tus ajustes actuales.')) return;
        setLoading(true);
        try {
            await api.post(`/backups/${id}/restore`);
            fetchData();
            alert('Restaurado con éxito');
        } catch (e) { alert('Error al restaurar'); }
        setLoading(false);
    };

    const exportConfig = async () => {
        try {
            const res = await api.get('/export-config');
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `config_bot_${company?.name || 'global'}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        } catch (e) { alert('Error al exportar'); }
    };

    const handleImport = async (e) => {
        // ... previous implementation ...
    };

    const handleLevelUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        formData.append('isKnowledge', 'true');

        setUploadingKnowledge(true);
        try {
            await api.post('/assets', formData);
            fetchData();
        } catch (e) { alert('Falló la subida'); }
        setUploadingKnowledge(false);
        if (knowledgeInputRef.current) knowledgeInputRef.current.value = '';
    };

    const deleteKnowledge = async (id) => {
        if (!confirm('¿Eliminar esta fuente de conocimiento? El bot dejará de usar esta información.')) return;
        try {
            await api.delete(`/assets/${id}`);
            fetchData();
        } catch (e) { alert('Error al borrar'); }
    };

    const renameAsset = async (id, currentName) => {
        const newName = prompt('Nuevo nombre del archivo:', currentName);
        if (!newName || newName === currentName) return;
        try {
            await api.put(`/assets/${id}`, { name: newName });
            fetchData();
        } catch (e) { alert('Error al renombrar'); }
    };

    const insertTag = (tagName) => {
        const tag = ` [SEND_PHOTO: ${tagName}] `;
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);

        const newValue = before + tag + after;
        handleChange(activePromptKey, newValue);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 0);
    };

    const renderPromptSection = () => {
        const currentPrompt = settings.find(s => s.key === activePromptKey) || { value: '' };
        
        const platforms = [
            { key: 'SYSTEM_PROMPT', label: 'General', icon: <RefreshCcw size={14}/> },
            { key: 'SYSTEM_PROMPT_TELEGRAM', label: 'Telegram', icon: <Smartphone size={14}/> },
            { key: 'SYSTEM_PROMPT_WHATSAPP', label: 'WhatsApp', icon: <MessageCircle size={14}/> },
            { key: 'SYSTEM_PROMPT_INSTAGRAM', label: 'Instagram', icon: <ImageIcon size={14}/> },
            { key: 'SYSTEM_PROMPT_FACEBOOK', label: 'Messenger', icon: <Send size={14}/> },
        ];

        return (
            <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Prompt del Sistema</h3>
                        <p className="text-xs text-gray-400">Define la personalidad y reglas según la red social.</p>
                    </div>
                    <button 
                        onClick={() => setShowAssetPicker(true)}
                        className="text-xs flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white font-bold transition-all"
                    >
                        <ImageIcon size={14} /> INSERTAR FOTO
                    </button>
                </div>

                <div className="flex gap-2 mb-4 p-1 bg-gray-50 rounded-xl w-fit">
                    {platforms.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setActivePromptKey(p.key)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activePromptKey === p.key ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {p.icon} {p.label}
                            {p.key !== 'SYSTEM_PROMPT' && settings.find(s => s.key === p.key) && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                        </button>
                    ))}
                </div>

                <textarea 
                    ref={textareaRef}
                    className="w-full border border-gray-100 p-4 rounded-2xl h-80 font-mono text-sm focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder-gray-300"
                    value={currentPrompt.value}
                    onChange={(e) => handleChange(activePromptKey, e.target.value)}
                    placeholder={activePromptKey === 'SYSTEM_PROMPT' ? "Define el prompt general..." : "Override específico para esta red (deja vacío para usar el general)"}
                />
                
                <div className="flex justify-end mt-4">
                    <button 
                        onClick={() => saveSetting(activePromptKey)}
                        disabled={loading}
                        className="bg-blue-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        <Save size={18} /> Guardar Prompt {platforms.find(p => p.key === activePromptKey)?.label}
                    </button>
                </div>
            </div>
        );
    };

    const renderIntegrationField = (label, key, placeholder, type = 'text') => {
        const setting = settings.find(s => s.key === key) || { value: '' };
        return (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">{label}</label>
                    <input 
                        type={type}
                        className="w-full border border-gray-50 p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        value={setting.value}
                        onChange={(e) => handleChange(key, e.target.value)}
                        placeholder={placeholder}
                    />
                </div>
                <button 
                    onClick={() => saveSetting(key)}
                    disabled={loading}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors"
                >
                    <Save size={12} /> Guardar
                </button>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto flex gap-8 pb-10">
            <div className="flex-1">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight italic uppercase">
                            ⚙️ Ajustes de {company ? company.name : 'Superadmin'}
                        </h2>
                        <p className="text-gray-400 text-sm">Gestiona prompts, integraciones y seguridad.</p>
                    </div>

                    <div className="flex gap-2">
                         <button onClick={exportConfig} className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm" title="Exportar Config">
                            <Download size={20} />
                         </button>
                         <div className="relative">
                            <input type="file" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-black hover:text-white transition-all shadow-sm">
                                <Upload size={20} />
                            </div>
                         </div>
                    </div>
                </div>
                
                {renderPromptSection()}

                <div className="mb-8 bg-blue-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 italic uppercase">
                                ✨ Reglas de Oro (Límites de la IA)
                            </h3>
                            <p className="text-blue-300 text-xs">Estas reglas se aplican a TODAS tus redes sociales para evitar alucinaciones.</p>
                        </div>
                        <button 
                            onClick={() => saveSetting('GROUNDING_RULES')}
                            disabled={loading}
                            className="bg-white text-blue-900 px-6 py-2 rounded-xl font-bold hover:bg-blue-400 hover:text-white transition-all text-sm flex items-center gap-2 shadow-lg"
                        >
                            <Save size={16} /> Guardar Reglas
                        </button>
                    </div>
                    <textarea 
                        className="w-full bg-blue-950 border border-blue-800 text-blue-100 p-4 rounded-2xl h-40 font-mono text-sm focus:ring-4 focus:ring-blue-500/20 outline-none transition-all placeholder-blue-800"
                        value={settings.find(s => s.key === 'GROUNDING_RULES')?.value || ''}
                        onChange={(e) => handleChange('GROUNDING_RULES', e.target.value)}
                        placeholder="- No inventar productos nuevos.&#10;- Si no sabes algo, di 'lo consultaré con un humano'.&#10;- Sé siempre profesional."
                    />
                </div>
                
                <div className="mb-10 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 italic uppercase">
                             🎨 Branding de la Empresa
                        </h3>
                        <p className="text-gray-400 text-xs text-wrap">Personaliza la identidad visual de tu bot (Logo lateral, Icono barra y Favicon de pestaña).</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { label: 'Logo Principal', type: 'logo', desc: 'Se muestra en el lateral.', current: company?.logo_url || settings.find(s => s.key === 'PLATFORM_LOGO_URL')?.value },
                            { label: 'Icono Barra', type: 'icon', desc: 'Versión compacta.', current: company?.icon_url || settings.find(s => s.key === 'PLATFORM_ICON_URL')?.value },
                            { label: 'Favicon', type: 'favicon', desc: 'Icono de la pestaña.', current: company?.favicon_url || settings.find(s => s.key === 'PLATFORM_FAVICON_URL')?.value }
                        ].map(b => (
                            <div key={b.type} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-white rounded-xl shadow-sm mb-4 flex items-center justify-center overflow-hidden border border-gray-100">
                                    {b.current ? (
                                        <img src={`${BASE_URL}/${b.current}`} alt={b.label} className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <ImageIcon className="text-gray-200" size={32} />
                                    )}
                                </div>
                                <div className="mb-4">
                                    <div className="text-xs font-black text-gray-700 uppercase tracking-tighter">{b.label}</div>
                                    <div className="text-[10px] text-gray-400">{b.desc}</div>
                                </div>
                                    <div className="flex flex-col gap-2 w-full mt-auto">
                                        <div className="relative w-full">
                                            <input 
                                                type="file" 
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (!file) return;
                                                    const formData = new FormData();
                                                    formData.append('type', b.type); 
                                                    formData.append('files', file);
                                                    setLoading(true);
                                                    try {
                                                        const companyId = company?.id || 'global';
                                                        const res = await api.post(`/companies/${companyId}/branding`, formData);
                                                        updateLocalBranding(b.type, res.data);
                                                        window.location.reload(); 
                                                    } catch (err) { 
                                                        console.error(err);
                                                        alert(`Error al subir branding: ${err.response?.data?.message || err.message}`); 
                                                    }
                                                    setLoading(false);
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <button className="w-full bg-white text-gray-800 text-[10px] font-bold py-2 rounded-xl border border-gray-200 hover:bg-black hover:text-white transition-all flex items-center justify-center gap-1">
                                                <Upload size={12} /> SUBIR NUEVO
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setBrandingTarget(b.type);
                                                setShowBrandingGallery(true);
                                            }}
                                            className="w-full bg-blue-50 text-blue-600 text-[10px] font-bold py-2 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1"
                                        >
                                            <ImageIcon size={12} /> DESDE GALERÍA
                                        </button>
                                    </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mb-10 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <History className="text-purple-600" /> Fuente de Conocimiento
                            </h3>
                            <p className="text-gray-400 text-xs">Sube PDFs o TXT para que el bot aprenda sobre tu negocio (Menús, FAQs, Precios).</p>
                        </div>
                        <div className="relative">
                            <input 
                                type="file" 
                                accept=".pdf,.txt"
                                multiple
                                ref={knowledgeInputRef}
                                onChange={handleLevelUpload} 
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={uploadingKnowledge}
                            />
                            <button className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-purple-700 transition-all text-sm flex items-center gap-2 shadow-md">
                                <Plus size={18} /> {uploadingKnowledge ? 'Procesando...' : 'Subir Documento'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {knowledgeAssets.length === 0 ? (
                            <div className="col-span-full py-10 border-2 border-dashed border-gray-100 rounded-2xl text-center text-gray-400 italic text-sm">
                                No has subido documentos de entrenamiento aún.
                            </div>
                        ) : (
                            knowledgeAssets.map(ka => (
                                <div key={ka.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            {ka.mimetype.includes('pdf') ? '📄' : '📝'}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-700 truncate w-48">{ka.name}</div>
                                            <div className="text-[10px] text-gray-400 uppercase font-black">{ka.mimetype.split('/')[1]} • Procesado</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => setPreviewAsset(ka)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            title="Vista Previa de Texto"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button 
                                            onClick={() => renameAsset(ka.id, ka.name)}
                                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                            title="Renombrar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button 
                                            onClick={() => deleteKnowledge(ka.id)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    <div className="col-span-full border-b pb-2 mb-2">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">🔌 Integraciones & API</h4>
                    </div>
                    {renderIntegrationField('OpenAI Key', 'OPENAI_API_KEY', 'sk-...', 'password')}
                    {renderIntegrationField('Telegram Token', 'TELEGRAM_BOT_TOKEN', '123:ABC...', 'password')}
                    <div className="col-span-full border-b pb-2 mb-2 mt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             🔗 Webhook Configuration (Meta App)
                        </h4>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-2">
                            <p className="text-xs text-blue-800 mb-2 font-bold">Callback URL para tu App de Meta (Edita si es necesario):</p>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    className="block flex-1 bg-white p-3 rounded border border-blue-200 text-xs text-gray-600 font-mono focus:ring-2 focus:ring-blue-100 outline-none"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                />
                                <button 
                                    onClick={() => saveSetting('META_WEBHOOK_URL', webhookUrl)}
                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors border border-green-200"
                                    title="Guardar URL"
                                >
                                    <Save size={16} />
                                </button>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors border border-blue-200"
                                    title="Copiar URL"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <p className="text-[10px] text-blue-600">
                                    ℹ️ Esta URL ya incluye tu dominio actual.
                                </p>
                                <button 
                                    onClick={() => setShowWebhookHelp(true)}
                                    className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full border border-blue-200 transition-colors font-medium flex items-center gap-1"
                                >
                                    📚 Ver Guía de Conexión
                                </button>
                            </div>
                        </div>
                    </div>
                    {renderIntegrationField('Verify Token (Define tu contraseña)', 'META_VERIFY_TOKEN', 'Ej: my_secret_token', 'text')}

                    <div className="col-span-full border-b pb-2 mb-2 mt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             🔵 Facebook Messenger
                        </h4>
                    </div>
                    {renderIntegrationField('Facebook Token', 'FACEBOOK_ACCESS_TOKEN', 'Token de Página (Page Access Token)', 'password')}
                    {renderIntegrationField('Facebook Page ID', 'FACEBOOK_PAGE_ID', 'Ej: 10043034... (Solo Números)')}

                    <div className="col-span-full border-b pb-2 mb-2 mt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             🟣 Instagram Business
                        </h4>
                    </div>
                    {renderIntegrationField('Instagram Token', 'INSTAGRAM_ACCESS_TOKEN', 'Token de Página (Opcional si es diferente)', 'password')}
                    {renderIntegrationField('Instagram Request ID', 'INSTAGRAM_PAGE_ID', 'Ej: 1784140... (ID de Cuenta Empresarial)')}
                    
                    <div className="col-span-full border-b pb-2 mb-2 mt-4"></div>
                    
                    <div className="col-span-full border-b pb-2 mb-2 mt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                             🟢 WhatsApp Business Cloud
                        </h4>
                    </div>
                    {renderIntegrationField('WhatsApp Token', 'WHATSAPP_ACCESS_TOKEN', 'Token de Sistema (Permanent Access Token)', 'password')}
                    {renderIntegrationField('Phone Number ID', 'WHATSAPP_PHONE_ID', 'Ej: 10595... (ID del Número de Teléfono)')}
                    {renderIntegrationField('WABA ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'Ej: 10080... (ID de Cuenta de WhatsApp Business)')}

                    {/* Baileys Quick Test */}
                    <div className="col-span-full bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border-2 border-dashed border-green-300 mt-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🧪</span>
                                <div>
                                    <h5 className="font-bold text-gray-700 text-sm">Modo Prueba Rápida (Baileys)</h5>
                                    <p className="text-xs text-gray-500">Conecta vía QR sin API oficial. Solo para pruebas.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBaileysModal(true)}
                                className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                            >
                                <Smartphone size={14} /> Probar WhatsApp
                            </button>
                        </div>
                    </div>

                    <div className="col-span-full border-b pb-2 mb-2 mt-4"></div>
                    {renderIntegrationField('Comandos de Prueba', 'ENABLE_TEST_COMMANDS', 'true / false')}
                    {renderIntegrationField('Buffer entre Mensajes (seg)', 'MESSAGE_BUFFER_SECONDS', 'Ej: 8 (espera entre mensajes rápidos)')}
                </div>

                {/* Security Settings - SuperAdmin Only */}
                {!company && (
                    <div className="mb-10 bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-red-800">
                                🔐 Seguridad de Plataforma
                            </h3>
                            <p className="text-red-600 text-xs">Configuración global de seguridad (solo SuperAdmin).</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100">
                                <label className="block text-xs font-bold text-red-700 mb-2 uppercase tracking-wider">
                                    Duración de Sesión (Horas)
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number"
                                        min="1"
                                        max="24"
                                        className="flex-1 border border-gray-100 p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-100 outline-none transition-all text-sm"
                                        value={settings.find(s => s.key === 'SESSION_DURATION_HOURS')?.value || '8'}
                                        onChange={(e) => handleChange('SESSION_DURATION_HOURS', e.target.value)}
                                        placeholder="8"
                                    />
                                    <button 
                                        onClick={() => saveSetting('SESSION_DURATION_HOURS')}
                                        disabled={loading}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all"
                                    >
                                        Guardar
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">Tiempo hasta que expire la sesión del usuario (1-24 horas).</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Export/Import Section */}
                <div className="mb-10 bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-3xl border border-purple-100 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2 text-purple-800">
                            📦 Exportar / Importar Perfil Completo
                        </h3>
                        <p className="text-purple-600 text-xs">Descarga todos los ajustes, prompts, APIs y medios para usarlos en otra empresa.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-100">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <Download size={18} className="text-purple-600" /> Exportar
                            </h4>
                            <p className="text-xs text-gray-500 mb-4">Descarga un ZIP con todas las configuraciones y medios de este perfil.</p>
                            <button 
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const response = await api.get('/export-config', { responseType: 'blob' });
                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.setAttribute('download', `profile_export_${Date.now()}.zip`);
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                    } catch (err) {
                                        alert('Error al exportar: ' + (err.response?.data?.error || err.message));
                                    }
                                    setLoading(false);
                                }}
                                disabled={loading}
                                className="w-full bg-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all text-sm flex items-center justify-center gap-2"
                            >
                                <Download size={16} /> Descargar Perfil Completo
                            </button>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-100">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <Upload size={18} className="text-indigo-600" /> Importar
                            </h4>
                            <p className="text-xs text-gray-500 mb-4">Carga un archivo ZIP previamente exportado para restaurar configuración.</p>
                            <label className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
                                <Upload size={16} /> Subir ZIP de Perfil
                                <input 
                                    type="file" 
                                    accept=".zip"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        
                                        if (!window.confirm('¿Está seguro? Esto sobrescribirá la configuración actual.')) return;
                                        
                                        setLoading(true);
                                        try {
                                            // For now, just show that import is not yet complete
                                            alert('Función de importación ZIP próximamente. Por ahora, puedes importar el config.json manualmente.');
                                        } catch (err) {
                                            alert('Error al importar: ' + err.message);
                                        }
                                        setLoading(false);
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Backups Section */}
                <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute right-[-20px] top-[-20px] opacity-10">
                        <History size={200} />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <History /> Historial de Seguridad
                                </h3>
                                <p className="text-gray-400 text-sm">Se mantienen las últimas 3 versiones de tus ajustes.</p>
                            </div>
                            <button 
                                onClick={createBackup}
                                disabled={loading}
                                className="bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-blue-400 transition-all text-sm flex items-center gap-2 shadow-lg"
                            >
                                <Plus size={16} /> Crear Backup
                            </button>
                        </div>

                        <div className="space-y-3">
                            {backups.length === 0 ? (
                                <div className="py-10 border border-dashed border-gray-700 rounded-2xl text-center text-gray-500 italic">
                                    No hay copias de seguridad guardadas.
                                </div>
                            ) : (
                                backups.map(b => (
                                    <div key={b.id} className="bg-gray-800 p-4 rounded-2xl flex justify-between items-center hover:bg-gray-750 transition-colors border border-gray-700">
                                        <div>
                                            <div className="font-bold text-blue-400">PUNTO DE RESTAURACIÓN</div>
                                            <div className="text-xs text-gray-400">Creado el {new Date(b.createdAt).toLocaleString()}</div>
                                        </div>
                                        <button 
                                            onClick={() => restoreBackup(b.id)}
                                            className="bg-gray-700 hover:bg-green-600 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                                        >
                                            RESTAURAR
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Float Asset Picker Modal (Reuse from previous, kept updated) */}
            {showAssetPicker && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-end">
                    <div className="w-[400px] bg-white h-full shadow-2xl flex flex-col animate-slide-in">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                                <ImageIcon size={22} className="text-blue-600" /> Galería de Tags
                            </h3>
                            <button onClick={() => setShowAssetPicker(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                            {/* Interactive Components Helper */}
                            <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg mb-6">
                                <h4 className="font-bold text-sm mb-1">Botón Interactivo</h4>
                                <p className="text-[10px] opacity-80 mb-3">Crea un botón con link (Telegram/Messenger).</p>
                                <button 
                                    onClick={() => {
                                        const label = prompt("Texto del botón:", "Catálogo");
                                        const url = prompt("URL del link:", "https://tu-web.com");
                                        if (label && url) {
                                            const tag = ` [BUTTON: ${label} | ${url}] `;
                                            const textarea = textareaRef.current;
                                            if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const newValue = textarea.value.substring(0, start) + tag + textarea.value.substring(end);
                                                handleChange(activePromptKey, newValue);
                                            }
                                        }
                                    }}
                                    className="w-full bg-white text-blue-600 py-2 rounded-xl font-bold text-xs hover:bg-gray-100 transition-colors shadow-sm"
                                >
                                    + INSERTAR BOTÓN
                                </button>
                            </div>

                            {assets.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <ImageIcon size={48} className="mx-auto mb-4 opacity-10" />
                                    <p className="font-bold">No tienes archivos</p>
                                    <p className="text-xs">Sube fotos en la sección Galería.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {assets.map(asset => (
                                        <div 
                                            key={asset.id} 
                                            onClick={() => insertTag(asset.name)}
                                            className="bg-white p-3 rounded-2xl border border-gray-100 hover:border-blue-500 cursor-pointer transition-all hover:shadow-xl group"
                                        >
                                            <div className="h-44 bg-gray-100 rounded-xl mb-3 overflow-hidden">
                                                <img src={`${BASE_URL}/${asset.url}`} alt={asset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            </div>
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[11px] font-black text-gray-700 uppercase truncate pr-4">{asset.name}</span>
                                                <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
                                                    <Plus size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Branding Gallery Selection Modal */}
            {showBrandingGallery && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-zoom-in">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                                    <ImageIcon className="text-blue-600" /> Seleccionar {brandingTarget === 'logo' ? 'Logo' : brandingTarget === 'icon' ? 'Icono' : 'Favicon'}
                                </h3>
                                <p className="text-xs text-gray-400">Elige una imagen de tu galería de activos para usar como branding.</p>
                            </div>
                            <button onClick={() => setShowBrandingGallery(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            {assets.filter(a => a.mimetype.startsWith('image/')).length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <ImageIcon size={48} className="mx-auto mb-4 opacity-10" />
                                    <p className="font-bold">No tienes imágenes en la galería</p>
                                    <p className="text-xs">Sube fotos primero desde la pestaña Galería.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {assets.filter(a => a.mimetype.startsWith('image/')).map(asset => (
                                        <div 
                                            key={asset.id} 
                                            onClick={async () => {
                                                setLoading(true);
                                                try {
                                                    const companyId = company?.id || 'global';
                                                    const res = await api.patch(`/companies/${companyId}/branding`, {
                                                        type: brandingTarget,
                                                        url: asset.url
                                                    });
                                                    updateLocalBranding(brandingTarget, res.data);
                                                    setShowBrandingGallery(false);
                                                    window.location.reload();
                                                } catch (err) {
                                                    // Replaced alert with console error and UI feedback (could be a toast/modal later)
                                                    console.error("Branding Error", err);
                                                }
                                                setLoading(false);
                                            }}
                                            className="bg-white p-2 rounded-2xl border border-gray-100 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg group text-center"
                                        >
                                            <div className="h-32 bg-gray-50 rounded-xl mb-2 overflow-hidden flex items-center justify-center border border-gray-50">
                                                <img src={`${BASE_URL}/${asset.url}`} alt={asset.name} className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div className="text-[10px] font-bold text-gray-600 truncate px-1 uppercase tracking-tighter">{asset.name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setShowBrandingGallery(false)}
                                className="bg-gray-800 text-white px-8 py-2 rounded-xl font-bold hover:bg-black transition-all text-xs"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewAsset && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-zoom-in">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Vista Previa: {previewAsset.name}</h3>
                                <p className="text-xs text-gray-400">Este es el texto que la IA lee para responder a tus clientes.</p>
                            </div>
                            <button onClick={() => setPreviewAsset(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 font-mono text-sm leading-relaxed text-gray-700 bg-white">
                            {previewAsset.extracted_text ? (
                                <pre className="whitespace-pre-wrap">{previewAsset.extracted_text}</pre>
                            ) : (
                                <div className="text-center py-20 text-gray-400 italic">No se pudo extraer texto de este archivo o está vacío.</div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setPreviewAsset(null)}
                                className="bg-gray-800 text-white px-8 py-2 rounded-xl font-bold hover:bg-black transition-all"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Webhook Help Modal */}
            {showWebhookHelp && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white text-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                🔌 Conectar tu App de Meta
                            </h3>
                            <p className="text-blue-100 text-sm mt-1">Guía paso a paso para Webhooks</p>
                            <button 
                                onClick={() => setShowWebhookHelp(false)}
                                className="absolute top-4 right-4 text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div className="flex gap-4">
                                <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-700">Ir a <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Meta Developers ↗</a></h5>
                                    <p className="text-xs text-gray-500">Entra a la configuración de tu App {'>'} Messenger {'>'} Webhooks.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-700">Pegar tu Callback URL</h5>
                                    <p className="text-xs text-gray-500">Usa la URL única que aparece en tu panel (Asegúrate de reemplazar `TU-DOMINIO.com` con tu dominio real).</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-700">Verify Token</h5>
                                    <p className="text-xs text-gray-500">Escribe la MISMA contraseña que definiste en el campo "Verify Token" de este panel.</p>
                                </div>
                            </div>
                             <div className="flex gap-4">
                                <div className="bg-green-100 text-green-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">4</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-700">Verificar y Guardar</h5>
                                    <p className="text-xs text-gray-500">Si los datos coinciden, Facebook mostrará un check verde ✅.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button 
                                onClick={() => setShowWebhookHelp(false)}
                                className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition-transform active:scale-95"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BaileysModal 
                isOpen={showBaileysModal} 
                onClose={() => setShowBaileysModal(false)} 
                companyId={company?.id || null}
            />
        </div>
    );
};
