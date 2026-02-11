import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { CompanyManagement } from '../components/CompanyManagement';
import { PlansManagement } from '../components/PlansManagement';
import { Reports } from '../components/Reports';
import { Settings } from '../components/Settings';

const SuperAdminDashboard = () => {
    const [currentView, setCurrentView] = useState('companies');
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));

    useEffect(() => {
        // Refresh user from storage in case of updates
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) setUser(storedUser);
    }, []);

    const renderView = () => {
        switch (currentView) {
            case 'companies': return <CompanyManagement />;
            case 'plans': return <PlansManagement />;
            case 'reports': return <Reports />;
            case 'settings': return <Settings />;
            default: return <CompanyManagement />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar currentView={currentView} setView={setCurrentView} user={user} />
            <div className="flex-1 overflow-auto">
                {renderView()}
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
