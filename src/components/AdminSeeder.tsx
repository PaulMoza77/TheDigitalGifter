import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";

export function AdminSeeder() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const seedTemplates = useMutation(api.templates.seed);
  const addMoreTemplates = useMutation(api.templates.addMoreTemplates);
  const clearAllTemplates = useMutation(api.templates.clearAll);
  const templates = useQuery(api.templates.list) || [];

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const result = await seedTemplates();
      if (result.success) {
        toast.success(`Successfully seeded ${result.count} templates!`);
      } else {
        toast.info(result.message);
      }
    } catch (error) {
      toast.error("Failed to seed templates: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleAddMore = async () => {
    setIsAddingMore(true);
    try {
      const result = await addMoreTemplates();
      toast.success(`Successfully added ${result.added} more templates!`);
    } catch (error) {
      toast.error("Failed to add templates: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsAddingMore(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to delete ALL templates? This cannot be undone.")) {
      return;
    }
    
    setIsClearing(true);
    try {
      const result = await clearAllTemplates();
      toast.success(`Successfully deleted ${result.deleted} templates!`);
    } catch (error) {
      toast.error("Failed to clear templates: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        🛠️ Template Management
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-800">Current Templates</p>
            <p className="text-sm text-gray-600">{templates.length} templates in database</p>
            <p className="text-xs text-blue-600 mt-1">
              ✨ Schema now includes orientation and textDefault fields
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isSeeding ? "Seeding..." : "Seed Initial Templates"}
          </button>

          <button
            onClick={handleAddMore}
            disabled={isAddingMore}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isAddingMore ? "Adding..." : "Add More Templates"}
          </button>

          <button
            onClick={handleClear}
            disabled={isClearing}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isClearing ? "Clearing..." : "Clear All"}
          </button>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          <p>• <strong>Seed Initial:</strong> Adds the basic Christmas card templates</p>
          <p>• <strong>Add More:</strong> Adds additional premium templates (cabin, forest, etc.)</p>
          <p>• <strong>Clear All:</strong> Removes all templates from database</p>
        </div>
      </div>
    </div>
  );
}
