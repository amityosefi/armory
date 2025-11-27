import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sword, Eye, Package, X } from 'lucide-react';

export interface SearchResult {
  type: 'person' | 'item';
  id: string | number;
  name: string;
  // Person fields
  phone?: string;
  location?: string;
  // Item fields
  kind?: string;
  personName?: string;
}

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchText: string;
  results: SearchResult[];
}

const SearchResultsModal: React.FC<SearchResultsModalProps> = ({
  isOpen,
  onClose,
  searchText,
  results
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handlePersonClick = (personId: string | number) => {
    navigate(`/soldier/${personId}`);
    onClose();
  };

  const handleItemClick = (item: SearchResult) => {
    // If item is in גדוד, סדנא, or מחסן, navigate to armory stocks
    if (item.location === 'גדוד' || item.location === 'סדנא' || item.location === 'מחסן') {
      navigate('/armory/7');
    } else if (item.location) {
      // Navigate to the person's page who has the item
      navigate(`/soldier/${item.location}`);
    }
    onClose();
  };

  const getItemIcon = (kind?: string) => {
    if (!kind) return <Package className="w-5 h-5" />;
    
    switch (kind) {
      case 'נשק':
        return <Sword className="w-5 h-5" />;
      case 'אמרל':
      case 'אופטיקה':
        return <Eye className="w-5 h-5" />;
      case 'ציוד':
        return <Package className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const getLocationDisplay = (item: SearchResult) => {
    if (item.location === 'גדוד' || item.location === 'סדנא' || item.location === 'מחסן') {
      return item.location;
    }
    return item.personName || item.location || 'לא ידוע';
  };

  const peopleResults = results.filter(r => r.type === 'person');
  const itemResults = results.filter(r => r.type === 'item');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            תוצאות חיפוש: "{searchText}"
          </h2>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              לא נמצאו תוצאות
            </div>
          ) : (
            <div className="space-y-6">
              {/* People Results */}
              {peopleResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    חיילים ({peopleResults.length})
                  </h3>
                  <div className="space-y-2">
                    {peopleResults.map((person, index) => (
                      <div
                        key={`person-${person.id}-${index}`}
                        onClick={() => handlePersonClick(person.id)}
                        className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors border border-blue-200"
                      >
                        <div className="bg-blue-500 text-white p-2 rounded-full">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-grow text-right">
                          <div className="font-semibold text-gray-800">{person.name}</div>
                          <div className="text-sm text-gray-600 flex gap-4">
                            {person.phone && <span>טלפון: {person.phone}</span>}
                            {person.location && <span>מיקום: {person.location}</span>}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                          מ.א: {person.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Item Results */}
              {itemResults.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    אמצעים ({itemResults.length})
                  </h3>
                  <div className="space-y-2">
                    {itemResults.map((item, index) => (
                      <div
                        key={`item-${item.id}-${index}`}
                        onClick={() => handleItemClick(item)}
                        className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg cursor-pointer transition-colors border border-green-200"
                      >
                        <div className="bg-green-500 text-white p-2 rounded-full">
                          {getItemIcon(item.kind)}
                        </div>
                        <div className="flex-grow text-right">
                          <div className="font-semibold text-gray-800">{item.name}</div>
                          <div className="text-sm text-gray-600 flex gap-4">
                            {item.kind && <span>סוג: {item.kind}</span>}
                            <span>מיקום: {getLocationDisplay(item)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                          מזהה: {item.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultsModal;
