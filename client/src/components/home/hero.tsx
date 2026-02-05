import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { usePopularCategories, useServiceCategories } from "@/lib/hooks";
import { useState, useMemo } from "react";
import { getCategorySuggestions } from "@/lib/autocomplete";
import { motion } from "framer-motion";
// @ts-ignore
import heroBgPng from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.png";
// @ts-ignore
import heroBgWebp from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.webp";

export function Hero() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const { data: popularData } = usePopularCategories();
  const { data: categoriesData } = useServiceCategories(true);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const categoryNames = useMemo(() => (categoriesData?.categories || []).map(c => c.name), [categoriesData]);
  const suggestions = useMemo(() => getCategorySuggestions(categoryNames, query, 6), [categoryNames, query]);

  const handleSearch = () => {
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        setQuery(suggestions[activeIdx]);
        setLocation(`/search?q=${encodeURIComponent(suggestions[activeIdx])}`);
        return;
      }
      handleSearch();
    }
  };

  return (
    <div className="relative h-[600px] w-full flex items-center justify-center bg-gray-900 text-white overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source srcSet={heroBgWebp} type="image/webp" />
          <img
            src={heroBgPng}
            alt=""
            fetchpriority="low"
            loading="lazy"
            decoding="async"
            className="object-cover w-full h-full"
          />
        </picture>
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 flex flex-col items-start max-w-4xl">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-bold font-heading mb-6 leading-tight"
        >
          Find the perfect <i className="font-serif font-light text-green-400">private detective</i><br />
          for your investigation.
        </motion.h1>
        
        {/* Search Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full bg-white rounded-md flex items-center p-1 pr-2 h-14 md:h-16 shadow-lg mb-6"
        >
          <div className="flex-1 h-full relative">
            <Search className="absolute ml-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 md:h-6 md:w-6" />
            <input 
              type="text" 
              className="w-full h-full pl-12 md:pl-14 text-gray-800 text-base md:text-lg outline-none placeholder:text-gray-400 rounded-l-md"
              placeholder="What service are you looking for?"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 120)}
            />
            {focused && suggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-20 text-gray-800">
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    onMouseDown={() => { setQuery(s); setLocation(`/search?q=${encodeURIComponent(s)}`); }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${activeIdx === i ? 'bg-gray-100' : ''} text-gray-800`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button 
            onClick={handleSearch}
            className="h-full px-8 md:px-10 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-md"
          >
            Search
          </Button>
        </motion.div>

        {/* Popular Tags */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap items-center gap-3 text-sm font-medium"
        >
          <span className="text-gray-300">Popular:</span>
          {((popularData?.categories || []).map(c => c.category)).slice(0, 6).map((tag) => (
            <button 
              key={tag}
              onClick={() => setLocation(`/search?q=${encodeURIComponent(tag)}`)}
              className="px-3 py-1 border border-white/30 rounded-full hover:bg-white hover:text-black transition-colors"
            >
              {tag}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
