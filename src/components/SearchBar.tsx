import React, { useState, useEffect } from 'react';
import type { SheetGroup } from '../types';
import { usePermissions } from "@/contexts/PermissionsContext";
import { supabase } from "@/lib/supabaseClient";
import SearchResultsModal, { SearchResult } from './armory/SearchResultsModal';

interface SearchBarProps {
  sheetGroups: SheetGroup[];
  accessToken: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ sheetGroups, accessToken }) => {
  const { permissions } = usePermissions();
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [allPeople, setAllPeople] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [peopleResponse, itemsResponse] = await Promise.all([
          supabase.from('people').select('*'),
          supabase.from('armory_items').select('*')
        ]);

        if (peopleResponse.data) setAllPeople(peopleResponse.data);
        if (itemsResponse.data) setAllItems(itemsResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleSearch = () => {
    if (!searchText.trim()) return;

    setLoading(true);
    const searchLower = searchText.trim().toLowerCase();
    const foundResults: SearchResult[] = [];

    // Search in people table
    allPeople.forEach(person => {
      const matchFields = [
        person.id?.toString(),
        person.name,
        person.phone,
        person.location
      ].filter(Boolean);

      const matches = matchFields.some(field =>
        field.toLowerCase().includes(searchLower)
      );

      if (matches) {
        foundResults.push({
          type: 'person',
          id: person.id,
          name: person.name,
          phone: person.phone,
          location: person.location
        });
      }
    });

    // Search in armory_items table
    allItems.forEach(item => {
      const matchFields = [
        item.id?.toString(),
        item.name,
        item.kind,
        item.location
      ].filter(Boolean);

      const matches = matchFields.some(field =>
        field.toLowerCase().includes(searchLower)
      );

      if (matches) {
        // Find the person's name if item is with a soldier
        let personName: string | undefined;
        const location = item.location;
        if (location !== 'גדוד' && location !== 'סדנא' && location !== 'מחסן') {
          // Convert both to strings for comparison to handle type mismatches
          const person = allPeople.find(p => String(p.id) === String(location));
          personName = person?.name;
        }

        foundResults.push({
          type: 'item',
          id: item.id,
          name: item.name,
          kind: item.kind,
          location: item.location,
          personName: personName
        });
      }
    });

    setResults(foundResults);
    setShowModal(true);
    setLoading(false);
  };

  return (
    <>
      {/* Search Bar */}
      {!permissions['Plugot'] && (
        <div className="flex w-full gap-2">
          <input
            type="text"
            placeholder="חפש חיילים ואמצעים..."
            className="flex-grow px-3 py-1 border rounded-md text-right"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'מחפש...' : 'חפש'}
          </button>
        </div>
      )}

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        searchText={searchText}
        results={results}
      />
    </>
  );
};

export default SearchBar;
