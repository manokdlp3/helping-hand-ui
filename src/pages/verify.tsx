import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next'; // Updated import for Next.js types
import Head from 'next/head'; // Updated import for Next.js document
import Link from 'next/link'; // Updated import for Next.js router
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState, useRef } from 'react';
import { CheckCircle } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useRouter } from 'next/router'; // Updated import for useRouter
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setApiResponse(null); // Clear any previous response
    }
  };

  const handleVerification = async () => {
    if (!selectedFile) {
      setApiResponse('Please select a verifiable credentials file first');
      return;
    }

    try {
      setIsLoading(true);
      
      // Read the file content
      const fileContent = await selectedFile.text();
      let vcData;
      try {
        vcData = JSON.parse(fileContent);
      } catch (error) {
        setApiResponse('Error: Invalid JSON file format');
        setIsLoading(false);
        return;
      }

      const response = await fetch(process.env.NEXT_PUBLIC_API_VERIFY_VC || '', {
        method: 'POST',
        headers: {
          "X-API-Token": process.env.NEXT_PUBLIC_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vcData),
      });
      
      const data = await response.json();
      console.log('API Response:', data);
      setApiResponse(data.message);
      
      if (data.isValid === true) {
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
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent animate-fade-in">
            Great! We can help you.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            First, let&apos;s get you verified.
          </p>
        </div>

        <div className="text-center mb-16 py-12 px-4">
          <div className="flex flex-col items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              className="mb-4"
            >
              {selectedFile ? 'Change File' : 'Select Verifiable Credentials File'}
            </Button>
            
            {selectedFile && (
              <p className="text-sm text-muted-foreground mb-4">
                Selected file: {selectedFile.name}
              </p>
            )}

            <Button 
              variant="destructive" 
              onClick={handleVerification}
              disabled={isLoading || !selectedFile}
            >
              {isLoading ? 'Processing...' : 'Verify'}
            </Button>
          </div>
          
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
