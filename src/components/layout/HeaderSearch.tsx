"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search as SearchIconLucide } from 'lucide-react';

interface HeaderSearchProps {
  placeholder: string;
  searchContext: 'admin' | 'non-admin';
  onSearchChange?: (term: string) => void;
}

export function HeaderSearch({ placeholder, searchContext, onSearchChange }: HeaderSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // For non-admin, state is managed locally. For admin, it's passed via props.
  const [localSearchTerm, setLocalSearchTerm] = useState(searchParams.get('q') || '');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // This effect ensures that when the URL's search param changes (e.g., from browser back/forward), the input updates.
  useEffect(() => {
    const urlSearchTerm = searchParams.get('q') || '';
    if (urlSearchTerm !== localSearchTerm && searchContext === 'non-admin') {
      setLocalSearchTerm(urlSearchTerm);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, searchContext]);


  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;

    if (searchContext === 'admin' && onSearchChange) {
      onSearchChange(newSearchTerm);
    } else {
      setLocalSearchTerm(newSearchTerm);
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
        
        // Non-admin search always redirects to a product discovery page
        const targetPath = (pathname === '/products' || pathname === '/gift-boxes') ? pathname : '/products';
        router.push(`${targetPath}?${params.toString()}`);
      }, 500);
    }
  };

  return (
    <div className="relative flex-1 w-full max-w-xs sm:max-w-sm md:w-64 lg:w-96">
      <SearchIconLucide className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="h-9 w-full pl-10"
        value={searchContext === 'admin' ? (onSearchChange ? undefined : '') : localSearchTerm} // Admin search is controlled by parent
        onChange={handleSearchChange}
      />
    </div>
  );
}
