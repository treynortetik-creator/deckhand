import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import type { AvailableModel } from '../lib/api';

interface ModelComboboxProps {
  models: AvailableModel[];
  value: string;
  onChange: (modelId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowDefault?: boolean;
  defaultLabel?: string;
}

function formatContextLength(length?: number): string | null {
  if (!length) return null;
  if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)}M`;
  if (length >= 1_000) return `${Math.round(length / 1_000)}K`;
  return `${length}`;
}

function formatPrice(pricing?: AvailableModel['pricing']): string | null {
  if (!pricing?.prompt || !pricing?.completion) return null;
  const promptPrice = parseFloat(pricing.prompt) * 1_000_000;
  const completionPrice = parseFloat(pricing.completion) * 1_000_000;
  if (isNaN(promptPrice) || isNaN(completionPrice)) return null;
  return `$${promptPrice.toFixed(2)}/$${completionPrice.toFixed(2)}`;
}

export function ModelCombobox({
  models,
  value,
  onChange,
  placeholder = 'Search models...',
  disabled = false,
  allowDefault = false,
  defaultLabel = 'Use Default',
}: ModelComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedModel = useMemo(
    () => models.find((m) => m.model_id === value),
    [models, value]
  );

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(
      (m) =>
        m.display_name.toLowerCase().includes(query) ||
        m.model_id.toLowerCase().includes(query)
    );
  }, [models, searchQuery]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredModels.length]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex + (allowDefault ? 1 : 0)] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen, allowDefault]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            Math.min(prev + 1, filteredModels.length - 1)
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, allowDefault ? -1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen) {
          if (highlightedIndex === -1 && allowDefault) {
            handleSelect('default');
          } else if (filteredModels[highlightedIndex]) {
            handleSelect(filteredModels[highlightedIndex].model_id);
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  const displayValue = value === 'default'
    ? defaultLabel
    : selectedModel?.display_name || value || '';

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-ocean-900 border border-ocean-700 rounded-lg cursor-pointer transition-all ${
          isOpen ? 'border-gold-500 ring-2 ring-gold-500/20' : 'hover:border-ocean-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={handleInputClick}
      >
        <Search className="w-4 h-4 text-ocean-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : displayValue}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          placeholder={isOpen ? placeholder : displayValue || placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-ocean-400 text-sm min-w-0"
        />
        <ChevronDown
          className={`w-4 h-4 text-ocean-400 flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-ocean-900 border border-ocean-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
        >
          {allowDefault && (
            <div
              className={`px-3 py-2 cursor-pointer border-b border-ocean-800 ${
                highlightedIndex === -1
                  ? 'bg-ocean-800'
                  : 'hover:bg-ocean-800/50'
              } ${value === 'default' ? 'text-gold-400' : 'text-ocean-300'}`}
              onClick={() => handleSelect('default')}
              onMouseEnter={() => setHighlightedIndex(-1)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{defaultLabel}</span>
                {value === 'default' && <Check className="w-4 h-4 text-gold-400" />}
              </div>
            </div>
          )}

          {filteredModels.length === 0 ? (
            <div className="px-3 py-4 text-center text-ocean-400 text-sm">
              No models found
            </div>
          ) : (
            filteredModels.map((model, index) => {
              const isSelected = model.model_id === value;
              const isHighlighted = index === highlightedIndex;
              const contextStr = formatContextLength(model.context_length);
              const priceStr = formatPrice(model.pricing);

              return (
                <div
                  key={model.model_id}
                  className={`px-3 py-2 cursor-pointer ${
                    isHighlighted ? 'bg-ocean-800' : 'hover:bg-ocean-800/50'
                  } ${isSelected ? 'border-l-2 border-gold-500' : ''}`}
                  onClick={() => handleSelect(model.model_id)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">
                        {model.display_name}
                      </div>
                      <div className="text-xs text-ocean-400 truncate">
                        {model.model_id}
                      </div>
                      {(contextStr || priceStr) && (
                        <div className="text-xs text-ocean-500 mt-0.5">
                          {[contextStr && `${contextStr} ctx`, priceStr && `${priceStr}/1M`]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-gold-400 flex-shrink-0 ml-2" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
