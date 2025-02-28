import { useState, useEffect, ChangeEvent } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, Button as MuiButton, TextField, Typography, Container, Paper, Grid } from '@mui/material';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { CheckCircle } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ContractPage = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  
  // Form states
  const [endDate, setEndDate] = useState('');
  const [subject, setSubject] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  
  // Result states
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);

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

  const handleAddFundraiser = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      
      const endDateTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
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

  const handleCheckAllowance = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      const allowance = await contract.checkAllowance();
      setResult(ethers.formatEther(allowance));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmergencyWithdraw = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      const tx = await contract.emergencyWithdraw(recipient);
      const receipt = await tx.wait();
      setResult(receipt);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGetAmountInBaseUnits = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      const result = await contract.getAmountInBaseUnits(ethers.parseEther(amount));
      setResult(ethers.formatEther(result));
    } catch (err: any) {
      setError(err.message);
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
        <title>Contract Interaction - Helping Hand</title>
        <meta
          content="Contract interaction page for Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} />

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Smart Contract Interaction
        </Typography>
        
        {error && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffebee' }}>
            <Typography color="error">{error}</Typography>
          </Paper>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Add Fundraiser</Typography>
              <Box component="form" sx={{ '& .MuiTextField-root': { m: 1, width: '100%' } }}>
                <TextField
                  label="End Date"
                  type="datetime-local"
                  value={endDate}
                  onChange={handleInputChange(setEndDate)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Subject"
                  value={subject}
                  onChange={handleInputChange(setSubject)}
                />
                <TextField
                  label="Additional Details"
                  multiline
                  rows={4}
                  value={additionalDetails}
                  onChange={handleInputChange(setAdditionalDetails)}
                />
                <TextField
                  label="Initial Amount (ETH)"
                  type="number"
                  value={initialAmount}
                  onChange={handleInputChange(setInitialAmount)}
                />
                <MuiButton
                  variant="contained"
                  onClick={handleAddFundraiser}
                  sx={{ mt: 2 }}
                >
                  Add Fundraiser
                </MuiButton>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Check Allowance</Typography>
              <MuiButton
                variant="contained"
                onClick={handleCheckAllowance}
                fullWidth
              >
                Check Allowance
              </MuiButton>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Emergency Withdraw</Typography>
              <TextField
                fullWidth
                label="Recipient Address"
                value={recipient}
                onChange={handleInputChange(setRecipient)}
                sx={{ mb: 2 }}
              />
              <MuiButton
                variant="contained"
                onClick={handleEmergencyWithdraw}
                fullWidth
              >
                Emergency Withdraw
              </MuiButton>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Get Amount in Base Units</Typography>
              <TextField
                fullWidth
                label="Amount (ETH)"
                type="number"
                value={amount}
                onChange={handleInputChange(setAmount)}
                sx={{ mb: 2 }}
              />
              <MuiButton
                variant="contained"
                onClick={handleGetAmountInBaseUnits}
                fullWidth
              >
                Get Base Units
              </MuiButton>
            </Paper>
          </Grid>

          {result && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Result</Typography>
                <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Container>

      <Footer />
    </div>
  );
};

export default ContractPage; 