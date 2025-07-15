
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search as SearchIconLucide } from 'lucide-react';

interface HeaderSearchProps {
  placeholder: string;
  initialSearchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function HeaderSearch({ placeholder, initialSearchTerm, onSearchChange }: HeaderSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [localSearchTerm, setLocalSearchTerm] = useState(initialSearchTerm ?? searchParams.get('q') ?? '');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state if initial search term changes from parent (e.g., admin sidebar search)
  useEffect(() => {
    if (initialSearchTerm !== undefined && initialSearchTerm !== localSearchTerm) {
      setLocalSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm, localSearchTerm]);

  // Sync state if URL search param changes
  useEffect(() => {
    const urlSearchTerm = searchParams.get('q') || '';
    if (urlSearchTerm !== localSearchTerm) {
      setLocalSearchTerm(urlSearchTerm);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setLocalSearchTerm(newSearchTerm);

    if (onSearchChange) {
      onSearchChange(newSearchTerm);
      return; // If parent handler is provided, let it control logic
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (newSearchTerm) {
        params.set('q', newSearchTerm);
      } else {
        params.delete('q');
      }
      
      const targetPath = (pathname === '/products' || pathname === '/gift-boxes') ? pathname : '/products';
      router.push(`${targetPath}?${params.toString()}`);
    }, 500); // 500ms debounce
  };

  return (
    <div className="relative flex-1 w-full max-w-xs sm:max-w-sm md:w-64 lg:w-96">
      <SearchIconLucide className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="h-9 w-full pl-10"
        value={localSearchTerm}
        onChange={handleSearchChange}
      />
    </div>
  );
}
