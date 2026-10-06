import { DRONE_IMAGE, DRONE_LABEL, DRONE_TYPES } from './types';
import type { DroneType } from './types';

interface Props {
  /** How many drones of each model this company holds. */
  counts: Record<DroneType, number>;
  onSelect: (type: DroneType) => void;
}

/**
 * The landing step of a company tab: two square cards, one per model.
 */
export function DroneTypeCards({ counts, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-6 justify-center py-6" dir="rtl">
      {DRONE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className="group w-64 h-64 flex flex-col items-center justify-between bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm transition-all hover:border-blue-500 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
            <img
              src={DRONE_IMAGE[type]}
              alt={DRONE_LABEL[type]}
              className="max-h-36 max-w-full object-contain"
            />
          </div>
          <div className="w-full text-center">
            <div className="text-lg font-bold text-gray-800 group-hover:text-blue-700">
              {DRONE_LABEL[type]}
            </div>
            <div className="text-sm text-gray-500">
              {counts[type] === 0 ? 'אין רחפנים' : `${counts[type]} רחפנים בחתימה`}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default DroneTypeCards;
