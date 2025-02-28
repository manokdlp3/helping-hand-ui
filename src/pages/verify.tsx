import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from 'react';
import vc from './vc.json';
import id from './id.json';
import { CheckCircle } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useRouter } from 'next/router';
import { useVerification } from '@/contexts/VerificationContext';

// Add this at the top of the component to make external links more secure
const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer"
};

const apiKey = process.env.NEXT_PUBLIC_API_KEY;

const Verify: NextPage = () => {
  const { setVerified } = useVerification();
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);  
  const router = useRouter();

  const handleVerification = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(process.env.NEXT_PUBLIC_API_VERIFY_VC || '', {
        method: 'POST',
        headers: {
          "X-API-Token": apiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vc),
      });
      const data = await response.json();
      console.log('API Response:', data);
      setApiResponse(data.message);
      
      if (data.isValid === true) {
        // Short delay to show success message before redirecting
        setTimeout(() => {
          handleVerificationSuccess();
        }, 1500);
      }
    } catch (error) {
      setApiResponse('Error: Failed to verify credentials');
      console.error('Verification failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSuccess = () => {
    setVerified(true);
    router.push('/helpme');
  };

  const handleLendAHand = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helpme');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Helping Hand - Crowd Funding on Blockchain</title>
        <meta
          content="A platform for crowdfunding on blockchain"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={handleLendAHand} />

      <main className="container mx-auto p-8 max-w-4xl">
        {/* Enhanced Hero Section */}
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent animate-fade-in">
            Great! We can help you.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            First, let's get you verified.
          </p>
        </div>

        <div className="text-center mb-16 py-12 px-4">
          <Button 
            variant="destructive" 
            onClick={handleVerification}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Verify'}
          </Button>
          
          {apiResponse && (
            <div className="mt-4 p-4 rounded-lg bg-secondary/30">
              <p className="text-foreground">{apiResponse}</p>
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
};

export default Verify;
