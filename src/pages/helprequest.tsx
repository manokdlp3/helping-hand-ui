import { useState, useEffect, ChangeEvent } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, TextField, Typography, Container, Paper, Grid, LinearProgress } from '@mui/material';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/router';
import { useVerification } from '@/contexts/VerificationContext';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const HelpRequestPage = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  const { isVerified } = useVerification();
  
  // Form states
  const [fundraiserId, setFundraiserId] = useState<string>('0');
  const [showDonationInput, setShowDonationInput] = useState(false);
  const [donationAmount, setDonationAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Contract constants
  const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const USDC_ABI = [
    'function transfer(address to, uint256 value) returns (bool)',
    'function approve(address spender, uint256 value) returns (bool)',
    'function balanceOf(address account) view returns (uint256)'
  ];
  
  // Result states
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [donationError, setDonationError] = useState<string>('');

  const router = useRouter();

  // Initialize contract instance
  useEffect(() => {
    const initializeContract = async () => {
      const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string;
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const contractInstance = new Contract(contractAddress, contractABI, signer);
          setContract(contractInstance);
        } catch (err) {
          console.error('Error getting signer:', err);
          setError('Failed to initialize contract');
        }
      }
    };
    initializeContract();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    const { helpRequestId } = router.query;
    if (helpRequestId && typeof helpRequestId === 'string' && contract) {
      setFundraiserId(helpRequestId);
      handleGetFundraiser();
    }
  }, [router.query, contract]); // Depend on both router.query and contract

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

  const handleAskForHelp = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helprequest');
  };

  const handleDonationSubmit = async () => {
    // Reset error state
    setDonationError('');
    setError('');

    // Validate amount
    const amount = parseFloat(donationAmount);
    if (!donationAmount || isNaN(amount)) {
      setDonationError('Please enter a valid amount');
      return;
    }
    if (amount <= 0) {
      setDonationError('Amount must be greater than 0');
      return;
    }
    if (result && amount > parseFloat(result.amountNeeded) - parseFloat(result.amountCollected)) {
      setDonationError('Amount exceeds the remaining goal amount');
      return;
    }

    if (!contract) {
      setError('Contract not initialized');
      return;
    }

    try {
      setIsSubmitting(true);

      // Convert amount to USDC's 6 decimal places using BigNumber
      const amountInUSDC = ethers.getBigInt(
        Math.floor(parseFloat(donationAmount) * 1_000_000).toString()
      );

      // Get the current signer
      if (!window.ethereum) throw new Error('No wallet detected');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      // Create USDC contract instance
      const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, signer);
      
      // Check USDC balance
      const balance = await usdcContract.balanceOf(address);
      if (balance < amountInUSDC) {
        throw new Error(`Insufficient USDC balance. You have ${ethers.formatUnits(balance, 6)} USDC but trying to send ${donationAmount} USDC`);
      }
      
      // Create and send the USDC transfer transaction
      const tx = await usdcContract.transfer(contract.target, amountInUSDC);
      await tx.wait();
      
      // After successful transfer, record the donation
      const donationTx = await contract.recordDonation(
        ethers.getBigInt(fundraiserId),
        amountInUSDC
      );
      await donationTx.wait();
      
      // Refresh fundraiser details
      await handleGetFundraiser();
      
      // Reset donation input
      setDonationAmount('');
      setShowDonationInput(false);
      
    } catch (err: any) {
      console.error('Error processing donation:', err);
      setError(err.message || 'Failed to process donation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Lend a Hand - Helping Hand</title>
        <meta
          content="View fundraiser details on the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={handleAskForHelp} />

      <Container maxWidth="md" sx={{ py: 4 }}>

        {!router.query.helpRequestId && (
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
        )}

        {result && (
          <Grid container spacing={4}>
            {/* Left Column */}
            <Grid item xs={12} md={8}>
              <Typography variant="h4" gutterBottom>
                {result.subject}
              </Typography>
              
              {/* Placeholder Image */}
              <Box 
                sx={{ 
                  width: '100%', 
                  height: 300, 
                  bgcolor: 'grey.200', 
                  mb: 3,
                  borderRadius: 1
                }} 
              />

              <Typography variant="subtitle1" gutterBottom>
                <strong>{result.owner}</strong> is asking for help.
              </Typography>

              <Typography 
                variant="body1" 
                sx={{ 
                  mt: 3,
                  whiteSpace: 'pre-line' 
                }}
              >
                {result.additionalDetails}
              </Typography>
            </Grid>

            {/* Right Column */}
            <Grid item xs={12} md={4}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3, 
                  borderRadius: 2,
                  bgcolor: 'background.paper'
                }}
              >
                <Typography variant="h4" gutterBottom>
                  {result.amountCollected} $USD
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    raised of {result.amountNeeded} $USD goal
                  </Typography>
                  
                  {/* Progress Bar */}
                  <Box sx={{ width: '100%', mb: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={Math.min((Number(result.amountCollected) / Number(result.amountNeeded)) * 100, 100)}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: 'success.main',
                          borderRadius: 4,
                        }
                      }}
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((Number(result.amountCollected) / Number(result.amountNeeded)) * 100)}% complete
                    </Typography>
                  </Box>
                </Box>

                {showDonationInput && (
                  <>
                    <TextField
                      fullWidth
                      label="How much?"
                      type="number"
                      value={donationAmount}
                      onChange={handleInputChange(setDonationAmount)}
                      inputProps={{ min: "0", step: "0.01" }}
                      sx={{ mb: 1 }}
                      error={!!donationError}
                      helperText={donationError}
                    />
                  </>
                )}

                <Button
                  className="w-full mt-2 py-6 text-lg font-semibold"
                  size="lg"
                  onClick={() => showDonationInput ? handleDonationSubmit() : setShowDonationInput(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : (showDonationInput ? 'Submit' : 'Lend a Hand')}
                </Button>
                {error && (
                  <Typography color="error" sx={{ mt: 2 }}>
                    {error}
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>

      <Footer />
    </div>
  );
};

export default HelpRequestPage; 