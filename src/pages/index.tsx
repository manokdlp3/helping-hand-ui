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

// Add this at the top of the component to make external links more secure
const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer"
};

const apiKey = process.env.NEXT_PUBLIC_API_KEY;

const Home: NextPage = () => {
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);  

  const handleLendAHand = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(process.env.NEXT_PUBLIC_API_VERIFY_VC || '', {
        method: 'POST',
        headers: {
            "X-API-Token": apiKey || '',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(vc), 
      }

      ); // Replace with your actual API endpoint
      const data = await response.json();
      console.log('API Response:', data);
      setApiResponse(data.message);
      setIsVerified(data.isValid === true);
    } catch (error) {
      setApiResponse('Error: Failed to fetch data');
      console.error('API call failed:', error);
    } finally {
      setIsLoading(false);
    }
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

      <Navigation isVerified={isVerified} />

      <main className="container mx-auto p-8 max-w-4xl">
        {/* Enhanced Hero Section */}
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent animate-fade-in">
            Welcome to Helping Hand
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your fundraising platform on blockchain.
          </p>
        </div>

        <div className="text-center mb-16 py-12 px-4">
          <Button 
            variant="destructive" 
            onClick={handleLendAHand}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Lend a Hand'}
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

export default Home;
