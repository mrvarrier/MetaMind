import { useState } from "react";
import { useSearchStore } from "../../stores/useSearchStore";
import { SearchFilters as SearchFiltersType } from "../../types";

export function SearchFilters() {
  const { filters, setFilters } = useSearchStore();
  const [localFilters, setLocalFilters] = useState<SearchFiltersType>(filters);

  const fileTypes = [
    { value: "pdf", label: "PDF Documents", icon: "📄" },
    { value: "docx", label: "Word Documents", icon: "📝" },
    { value: "jpg", label: "Images", icon: "🖼️" },
    { value: "mp3", label: "Audio", icon: "🎵" },
    { value: "mp4", label: "Videos", icon: "🎬" },
    { value: "py", label: "Code Files", icon: "💻" },
  ];

  const categories = [
    { value: "document", label: "Documents", icon: "📄" },
    { value: "image", label: "Images", icon: "🖼️" },
    { value: "audio", label: "Audio", icon: "🎵" },
    { value: "video", label: "Videos", icon: "🎬" },
    { value: "code", label: "Code", icon: "💻" },
    { value: "archive", label: "Archives", icon: "📦" },
  ];

  const handleApplyFilters = () => {
    setFilters(localFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters: SearchFiltersType = {};
    setLocalFilters(emptyFilters);
    setFilters(emptyFilters);
  };

  const toggleFileType = (fileType: string) => {
    const currentTypes = localFilters.file_types || [];
    const newTypes = currentTypes.includes(fileType)
      ? currentTypes.filter(t => t !== fileType)
      : [...currentTypes, fileType];
    
    setLocalFilters({
      ...localFilters,
      file_types: newTypes.length > 0 ? newTypes : undefined,
    });
  };

  const toggleCategory = (category: string) => {
    const currentCategories = localFilters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    setLocalFilters({
      ...localFilters,
      categories: newCategories.length > 0 ? newCategories : undefined,
    });
  };

  const updateSizeRange = (field: 'min' | 'max', value: string) => {
    const numValue = value ? parseInt(value) * 1024 * 1024 : undefined; // Convert MB to bytes
    setLocalFilters({
      ...localFilters,
      size_range: {
        ...localFilters.size_range,
        [field]: numValue,
      },
    });
  };

  const updateDateRange = (field: 'start' | 'end', value: string) => {
    setLocalFilters({
      ...localFilters,
      date_range: {
        ...localFilters.date_range,
        [field]: value || undefined,
      },
    });
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-apple-lg p-6">
      <div className="grid md:grid-cols-4 gap-6">
        {/* File Types */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            File Types
          </h3>
          <div className="space-y-2">
            {fileTypes.map((type) => (
              <label
                key={type.value}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(localFilters.file_types || []).includes(type.value)}
                  onChange={() => toggleFileType(type.value)}
                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-lg">{type.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {type.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Categories
          </h3>
          <div className="space-y-2">
            {categories.map((category) => (
              <label
                key={category.value}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(localFilters.categories || []).includes(category.value)}
                  onChange={() => toggleCategory(category.value)}
                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-lg">{category.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {category.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* File Size */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            File Size (MB)
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Minimum
              </label>
              <input
                type="number"
                placeholder="0"
                value={localFilters.size_range?.min ? Math.round((localFilters.size_range.min) / (1024 * 1024)) : ""}
                onChange={(e) => updateSizeRange('min', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Maximum
              </label>
              <input
                type="number"
                placeholder="∞"
                value={localFilters.size_range?.max ? Math.round((localFilters.size_range.max) / (1024 * 1024)) : ""}
                onChange={(e) => updateSizeRange('max', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Date Modified
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                From
              </label>
              <input
                type="date"
                value={localFilters.date_range?.start || ""}
                onChange={(e) => updateDateRange('start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                To
              </label>
              <input
                type="date"
                value={localFilters.date_range?.end || ""}
                onChange={(e) => updateDateRange('end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-apple text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Actions */}
      <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleClearFilters}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          Clear all filters
        </button>
        
        <div className="flex space-x-3">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-primary-600 text-white rounded-apple hover:bg-primary-700 text-sm font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}