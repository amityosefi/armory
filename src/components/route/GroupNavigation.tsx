import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';  // adjust the path if needed
import type { SheetGroup } from '../../types';
import {usePermissions} from "@/contexts/PermissionsContext";


interface GroupNavigationProps {
  sheetGroups: SheetGroup[];
}

const GroupNavigation: React.FC<GroupNavigationProps> = ({ sheetGroups }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentPath = location.pathname;
  const { permissions } = usePermissions();

  return (
      <div>
        {isMobile ? (
            <div className="flex flex-col gap-2">
                <select
                    className="border px-2 py-1 rounded text-sm"
                    onChange={(e) => {
                      const index = e.target.value;
                      navigate(`/group/${index}/sheet/0/row/0`);
                    }}
                    defaultValue={sheetGroups.findIndex(
                        (_, i) => currentPath.includes(`/group/${i}`)
                    )}
                >
                  {sheetGroups.map((group, index) => {
                    if (permissions[group.name] === false) return null;
                    return (
                        <option key={index} value={index}>
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
                const isActive = currentPath.includes(`/group/${index}`);
                return (
                    <Link
                        key={index}
                        to={`/group/${index}/sheet/0/row/0`}
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
