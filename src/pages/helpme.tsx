import { useState, useEffect, ChangeEvent } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, TextField, Typography, Container, Paper, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from '@mui/material';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/router';

declare global {
  interface Window {
    ethereum?: any;
  }
}

type Duration = '7' | '30';

const HelpMePage = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  
  // Form states
  const [duration, setDuration] = useState<Duration>('7');
  const [subject, setSubject] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  
  // Result states
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const router = useRouter();

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

  const calculateEndDate = (durationInDays: number): number => {
    const now = new Date();
    const endDate = new Date(now.getTime() + durationInDays * 24 * 60 * 60 * 1000);
    return Math.floor(endDate.getTime() / 1000);
  };

  const handleAddFundraiser = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      
      const endDateTimestamp = calculateEndDate(parseInt(duration));
      const amountInWei = ethers.parseEther(initialAmount);
      
      const tx = await contract.addFundraiser(
        endDateTimestamp,
        subject,
        additionalDetails,
        amountInWei
      );
      
      const receipt = await tx.wait();
      setResult(receipt);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInputChange = (setter: (value: string) => void) => (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setter(e.target.value);
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDuration(event.target.value as Duration);
  };

  const handleLendAHand = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helprequest');
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

      <Navigation isVerified={isVerified} onAskForHelp={handleLendAHand} />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Create New Fundraiser
        </Typography>
        
        {error && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>New Fundraiser Details</Typography>
          <Box component="form" sx={{ '& .MuiTextField-root': { m: 1, width: '100%' } }}>
            <FormControl component="fieldset" sx={{ m: 1, width: '100%' }}>
              <FormLabel component="legend">Duration</FormLabel>
              <RadioGroup
                row
                value={duration}
                onChange={handleDurationChange}
                sx={{ justifyContent: 'space-around', py: 2 }}
              >
                <FormControlLabel 
                  value="7" 
                  control={<Radio />} 
                  label="7 Days"
                  sx={{ 
                    border: '1px solid',
                    borderColor: duration === '7' ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    px: 2,
                    mx: 1
                  }}
                />
                <FormControlLabel 
                  value="30" 
                  control={<Radio />} 
                  label="30 Days"
                  sx={{ 
                    border: '1px solid',
                    borderColor: duration === '30' ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    px: 2,
                    mx: 1
                  }}
                />
              </RadioGroup>
            </FormControl>
            <TextField
              label="What kind of help do you need?"
              value={subject}
              onChange={handleInputChange(setSubject)}
            />
            <TextField
              label="Tell us more. Provide a detailed description."
              multiline
              rows={4}
              value={additionalDetails}
              onChange={handleInputChange(setAdditionalDetails)}
            />
            <TextField
              label="How much do you need? (in $USD)"
              type="number"
              value={initialAmount}
              onChange={handleInputChange(setInitialAmount)}
            />
            <Button
              className="mt-4 w-full"
              onClick={handleAddFundraiser}
            >
              Create Fundraiser
            </Button>
          </Box>
        </Paper>

        {result && (
          <Paper sx={{ p: 2, mt: 4 }}>
            <Typography variant="h6" gutterBottom>Transaction Result</Typography>
            <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </Paper>
        )}
      </Container>

      <Footer />
    </div>
  );
};

export default HelpMePage; 