import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useRouter } from 'next/router';
import { useVerification } from '@/contexts/VerificationContext';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const TempPage = () => {
  const router = useRouter();
  const { isVerified } = useVerification();
  const [contract, setContract] = useState<Contract | null>(null);
  
  // Form states
  const [duration, setDuration] = useState<'7' | '30'>('7');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  
  // Status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Initialize contract instance
  useEffect(() => {
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string;
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.getSigner().then(signer => {
        const contractInstance = new Contract(contractAddress, contractABI, signer);
        setContract(contractInstance);
      }).catch(err => {
        console.error('Error getting signer:', err);
        setError('Failed to initialize contract');
      });
    }
  }, []);

  const handleAskForHelp = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helpme');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (!contract) {
        throw new Error('Contract not initialized');
      }

      // Calculate end timestamp based on selected duration
      const durationInDays = parseInt(duration);
      const endTimestamp = Math.floor(Date.now() / 1000) + (durationInDays * 24 * 60 * 60);
      
      // Convert amount to USDC base units (6 decimals)
      const amountNumber = parseFloat(amount);
      if (isNaN(amountNumber)) {
        throw new Error('Invalid amount');
      }
      // Convert to USDC base units (multiply by 10^6)
      const amountInBaseUnits = Math.floor(amountNumber * 1_000_000);
      if (amountInBaseUnits <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Call the addFundraiser function
      const tx = await contract.addFundraiser(
        endTimestamp,
        subject,
        details,
        amountInBaseUnits
      );

      await tx.wait();
      setSuccess('Fundraiser created successfully!');
      
      // Reset form
      setDuration('7');
      setSubject('');
      setDetails('');
      setAmount('');
      
    } catch (err: any) {
      console.error('Error creating fundraiser:', err);
      setError(err.message || 'Failed to create fundraiser');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Create Fundraiser - Helping Hand</title>
        <meta
          content="Create a new fundraiser on the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={handleAskForHelp} />

      <main className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Create a New Fundraiser</CardTitle>
            <CardDescription>Fill out the form below to create your fundraiser</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Duration
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="7"
                      checked={duration === '7'}
                      onChange={(e) => setDuration(e.target.value as '7' | '30')}
                      className="mr-2"
                    />
                    7 Days
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="30"
                      checked={duration === '30'}
                      onChange={(e) => setDuration(e.target.value as '7' | '30')}
                      className="mr-2"
                    />
                    30 Days
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter fundraiser title"
                  required
                />
              </div>

              <div>
                <label htmlFor="details" className="block text-sm font-medium mb-1">
                  Additional Details
                </label>
                <textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  rows={4}
                  placeholder="Enter fundraiser description"
                  required
                />
              </div>

              <div>
                <label htmlFor="amount" className="block text-sm font-medium mb-1">
                  Amount Needed (USDC)
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter amount in USDC"
                  min="0"
                  step="0.000001"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
                  {success}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Ask For Help'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default TempPage;
