import { Aperture } from 'lucide-react'; // Example icon
import Link from 'next/link';

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
}

export function Logo({ className, iconSize = 28, textSize = "text-2xl" }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <Aperture className="text-primary" size={iconSize} />
      <h1 className={`font-headline font-bold ${textSize} text-foreground`}>
        ZellowLive
      </h1>
    </Link>
  );
}
