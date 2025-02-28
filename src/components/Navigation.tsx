import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { CheckCircle } from 'lucide-react';

interface NavigationProps {
  isVerified?: boolean;
}

export const Navigation = ({ isVerified = false }: NavigationProps) => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
              Helping Hand
            </h1>
          </Link>
        </div>
        <div className="hidden md:flex items-center space-x-6">
          <Button variant="ghost" asChild>
            <Link href="/">Lend a Hand</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Fundraise</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/contract">Test Contract</Link>
          </Button>
        </div>
        <CheckCircle 
            className={`w-6 h-6 ${isVerified ? 'text-green-500' : 'text-gray-300'}`} 
          />
        <ConnectButton />
      </div>
    </nav>
  );
}; 