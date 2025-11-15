import React from 'react';
import GroupNavigation from './GroupNavigation';
import SearchBar from '../SearchBar';
import { SheetGroup } from '@/types';
import useIsMobile from '../../hooks/useIsMobile';

interface NavBarProps {
  sheetGroups: SheetGroup[];
  accessToken: string;
  onSignOut: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ sheetGroups, accessToken, onSignOut }) => {
  const isMobile = useIsMobile();
  return (
    <>
      {/* Header with title, navigation and sign out button */}
      <div className="flex justify-between items-center mb-4">
        <div className='flex gap-5'>
          {/* Title on the left */}
          <h1 className="text-2xl font-bold text-gray-800">נשקיה 8101</h1>

          {/* Group Navigation */}
          <div>
            <GroupNavigation sheetGroups={sheetGroups} />
          </div>
        </div>

        <div className='flex gap-10'>
          {/* Search Bar - Desktop */}
          <div className={isMobile ? 'hidden' : 'block'}>
            <SearchBar sheetGroups={sheetGroups} accessToken={accessToken} />
          </div>

          {/* Sign out button on the right */}
          <button
            onClick={onSignOut}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded text-sm transition-colors"
          >
            התנתק
          </button>
        </div>
      </div>
      
      {/* Search Bar - Mobile */}
      <div className={isMobile ? 'block mb-2' : 'hidden'}>
        <SearchBar sheetGroups={sheetGroups} accessToken={accessToken} />
      </div>
    </>
  );
};

export default NavBar;
