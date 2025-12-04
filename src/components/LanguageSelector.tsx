import React, { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { LANGUAGES, Language } from "@/data/languages";
import { Search } from "lucide-react";

interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
  disabled?: boolean;
}

export default function LanguageSelector({
  value,
  onChange,
  disabled = false,
}: LanguageSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return LANGUAGES;
    const query = searchQuery.toLowerCase();
    return LANGUAGES.filter((lang) => lang.name.toLowerCase().includes(query));
  }, [searchQuery]);

  // Get the selected language object
  const selectedLanguage = LANGUAGES.find((lang) => lang.name === value);

  return (
    <div className="relative">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="min-w-[180px] bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.2)] text-white hover:bg-[rgba(255,255,255,.15)] transition-colors">
          <SelectValue>
            {selectedLanguage ? (
              <span className="flex items-center gap-2">
                <span className="text-lg">{selectedLanguage.flag}</span>
                <span>{selectedLanguage.name}</span>
              </span>
            ) : (
              "Select Language"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[#0b1220] border-[rgba(255,255,255,.2)] text-white max-h-[300px]">
          {/* Search input */}
          <div className="sticky top-0 z-10 bg-[#0b1220] p-2 border-b border-[rgba(255,255,255,.1)]">
            <div className="relative">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 text-[#c1c8d8]"
                size={16}
              />
              <input
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.2)] rounded-lg text-white placeholder:text-[#c1c8d8] focus:outline-none focus:ring-2 focus:ring-[#ffd976]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Language options */}
          <div className="py-1">
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((lang) => (
                <SelectItem
                  key={lang.code}
                  value={lang.name}
                  className="focus:bg-[rgba(255,255,255,.1)] focus:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-[#c1c8d8] text-center">
                No languages found
              </div>
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
