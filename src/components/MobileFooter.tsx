import React from 'react';
import { Building2, Radio, Package } from 'lucide-react';
import { TabID } from './Sidebar.tsx';
import { User } from '../types.ts';

interface MobileFooterProps {
  activeTab: TabID;
  onChangeTab: (tab: TabID) => void;
  currentUser?: User | null;
}

export default function MobileFooter({ activeTab, onChangeTab, currentUser }: MobileFooterProps) {
  const rawNavItems = [
    { id: 'monitoring' as TabID, label: 'Monitoring', icon: <Radio size={20} /> },
    { id: 'dashboard' as TabID, label: 'Dashboard', icon: <Building2 size={20} /> },
    { id: 'asset' as TabID, label: 'Asset', icon: <Package size={20} /> },
  ];

  const navItems = rawNavItems.filter(item => {
    if (currentUser?.permissions && Array.isArray(currentUser.permissions)) {
      return currentUser.permissions.includes(item.id);
    }
    return true;
  });

  if (navItems.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0F172A] border-t border-[#1E293B]/80 h-16 flex md:hidden items-center justify-around z-[9999] px-4 shadow-[0_-10px_20px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChangeTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 w-20 h-12 rounded-xl transition-all relative ${
              isActive 
                ? 'text-[#38BDF8]' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
              {item.icon}
            </div>
            <span className={`text-[10px] font-medium tracking-tight font-sans ${isActive ? 'font-bold' : ''}`}>
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-[2px] bg-[#38BDF8] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
