import { useState, useEffect, ChangeEvent } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, TextField, Typography, Container, Paper } from '@mui/material';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const HelpRequestPage = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  
  // Form states
  const [fundraiserId, setFundraiserId] = useState<string>('0');
  
  // Result states
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

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

  const handleGetFundraiser = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      if (!fundraiserId.trim()) throw new Error('Please enter a fundraiser ID');
      
      const parsedId = parseInt(fundraiserId);
      if (isNaN(parsedId)) {
        throw new Error('Please enter a valid number');
      }

      const fundraiser = await contract.getFundraiser(parsedId);
      console.log('Raw fundraiser data:', fundraiser);

      const fundraiserData = Array.isArray(fundraiser) ? {
        owner: fundraiser[0],
        startDate: fundraiser[1],
        endDate: fundraiser[2],
        subject: fundraiser[3],
        additionalDetails: fundraiser[4],
        amountNeeded: fundraiser[5],
        amountCollected: fundraiser[6],
        isGoalReached: fundraiser[7]
      } : fundraiser;

      console.log('Processed fundraiser data:', fundraiserData);

      setResult({
        owner: fundraiserData.owner,
        startDate: new Date(Number(fundraiserData.startDate) * 1000).toLocaleString(),
        endDate: new Date(Number(fundraiserData.endDate) * 1000).toLocaleString(),
        subject: fundraiserData.subject,
        additionalDetails: fundraiserData.additionalDetails,
        amountNeeded: ethers.formatEther(fundraiserData.amountNeeded),
        amountCollected: ethers.formatEther(fundraiserData.amountCollected),
        isGoalReached: fundraiserData.isGoalReached
      });
    } catch (err: any) {
      console.error('Error details:', err);
      setError(err.message || 'Failed to get fundraiser details');
    }
  };

  const handleInputChange = (setter: (value: string) => void) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setter(e.target.value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>View Fundraiser - Helping Hand</title>
        <meta
          content="View fundraiser details on the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          View Fundraiser Details
        </Typography>
        
        {error && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>Enter Fundraiser ID</Typography>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Fundraiser ID"
              type="number"
              value={fundraiserId}
              onChange={handleInputChange(setFundraiserId)}
              inputProps={{ min: "0", step: "1" }}
              sx={{ mb: 2 }}
            />
            <Button
              className="w-full"
              onClick={handleGetFundraiser}
            >
              Get Fundraiser Details
            </Button>
          </Box>
        </Paper>

        {result && (
          <Paper sx={{ p: 4, mt: 4 }}>
            <Typography variant="h6" gutterBottom>Fundraiser Details</Typography>
            <div className="space-y-2">
              <Typography><strong>Owner:</strong> {result.owner}</Typography>
              <Typography><strong>Start Date:</strong> {result.startDate}</Typography>
              <Typography><strong>End Date:</strong> {result.endDate}</Typography>
              <Typography><strong>Subject:</strong> {result.subject}</Typography>
              <Typography><strong>Details:</strong> {result.additionalDetails}</Typography>
              <Typography><strong>Amount Needed:</strong> {result.amountNeeded} ETH</Typography>
              <Typography><strong>Amount Collected:</strong> {result.amountCollected} ETH</Typography>
              <Typography><strong>Goal Reached:</strong> {result.isGoalReached ? 'Yes' : 'No'}</Typography>
            </div>
          </Paper>
        )}
      </Container>

      <Footer />
    </div>
  );
};

export default HelpRequestPage; 