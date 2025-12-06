import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';  // adjust the path if needed
import { sheetGroups } from "@/constants";
import {usePermissions} from "@/contexts/PermissionsContext";


const GroupNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentPath = location.pathname;
  const { permissions, isPermissionsLoaded } = usePermissions();

  if (!isPermissionsLoaded) {
    return null;
  }

  // Helper function to check if user has access to any sheet in the group
  const hasGroupAccess = (group: typeof sheetGroups[0]) => {
    // Check if user has the group-level permission (e.g., 'armory')
    if (permissions[group.pathName] || permissions['admin']) return true;
    // Check if user has permission for any sheet within the group (e.g., 'ג')
    return group.sheets.some(sheet => permissions[sheet.range]);
  };

  return (
      <div>
        {isMobile ? (
            <div className="flex flex-col gap-2">
                <select
                    className="border px-2 py-1 rounded text-sm"
                    onChange={(e) => {
                      const pathName = e.target.value;
                      navigate(`/${pathName}/0`);
                    }}
                    defaultValue={sheetGroups.find(
                        (group) => currentPath.includes(`/${group.pathName}`)
                    )?.pathName || sheetGroups[0]?.pathName}
                >
                  {sheetGroups.map((group, index) => {
                    if (!hasGroupAccess(group)) return null;
                    return (
                        <option key={index} value={group.pathName}>
                          {group.name}
                        </option>
                    );
                  })}
                </select>
                {permissions['admin'] && (
                    <button
                        onClick={() => navigate('/admin')}
                        className="bg-red-600 text-white px-2 py-1 rounded text-sm font-medium hover:bg-red-700"
                    >
                        ניהול מערכת
                    </button>
                )}
            </div>
        ) : (
            <div className="flex gap-3 flex-wrap">
              {sheetGroups.map((group, index) => {
                if (!hasGroupAccess(group)) return null;
                const isActive = currentPath.includes(`/${group.pathName}`);
                return (
                    <Link
                        key={index}
                        to={`/${group.pathName}/0`}
                        className={`px-4 py-1 rounded-lg font-medium transition-colors ${
                            isActive
                                ? 'bg-blue-700 text-white shadow-md'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                    >
                      {group.name}
                    </Link>
                );
              })}
              {permissions['admin'] && (
                <Link
                    to="/admin"
                    className="px-4 py-1 rounded-lg font-medium transition-colors bg-red-600 text-white hover:bg-red-700"
                >
                    ניהול מערכת
                </Link>
              )}
            </div>
        )}
      </div>
  );
};

export default GroupNavigation;
