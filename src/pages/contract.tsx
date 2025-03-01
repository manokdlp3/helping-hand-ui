import { useState, useEffect, ChangeEvent } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, TextField, Typography, Container, Paper, Grid } from '@mui/material';
import Head from 'next/head';
import { Button } from "@/components/ui/button";
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ContractPage = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  
  // Form states
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [donationAmount, setDonationAmount] = useState('');
  const [fundraiserId, setFundraiserId] = useState('');
  
  // Result states
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);

  const router = useRouter();

  const [connectedAccount, setConnectedAccount] = useState<string>('');

  const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const USDC_ABI = [
    'function transfer(address to, uint256 value) returns (bool)',
    'function approve(address spender, uint256 value) returns (bool)',
    'function balanceOf(address account) view returns (uint256)'
  ];

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

  const handleCheckUSDCBalance = async () => {
    try {
      if (!window.ethereum) throw new Error('No wallet detected');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      // Create USDC contract instance
      const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, signer);
      
      // Get balance
      const balance = await usdcContract.balanceOf(address);
      setResult(`USDC Balance: ${ethers.formatUnits(balance, 6)} USDC`);
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRecordDonation = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      if (!donationAmount || !fundraiserId) {
        throw new Error('Please fill in all donation fields');
      }
      
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
      const receipt = await tx.wait();
      setResult(receipt);
      
      // After successful transfer, record the donation
      const donationTx = await contract.recordDonation(
        ethers.getBigInt(fundraiserId),
        amountInUSDC
      );
      const donationReceipt = await donationTx.wait();
      setResult(donationReceipt);
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApproveUSDC = async () => {
    try {
      if (!contract) throw new Error('Contract not initialized');
      
      // Get the current signer
      if (!window.ethereum) throw new Error('No wallet detected');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Create USDC contract instance
      const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, signer);
      
      // Approve max uint256
      const maxUint256 = ethers.MaxUint256;
      const tx = await usdcContract.approve(contract.target, maxUint256);
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

  const handleLendAHand = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helprequest');
  };

  const handleOpenWallet = async () => {
    try {
      if (!window.ethereum) throw new Error('No wallet detected');
      
      // Get accounts
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        // If no account connected, request connection
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
      
      // Get current account
      const currentAccounts = await window.ethereum.request({ method: 'eth_accounts' });
      setConnectedAccount(currentAccounts[0]);
      
      // Try to send a test transaction
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Create a simple transaction (0 ETH transfer to self)
      const tx = {
        to: currentAccounts[0],
        value: "0x0"
      };
      
      // This will trigger MetaMask
      await signer.sendTransaction(tx);
      
    } catch (err: any) {
      setError(err.message);
    }
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

      <Navigation isVerified={isVerified} onAskForHelp={handleLendAHand} />

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
              <Typography variant="body1" gutterBottom>
                {connectedAccount ? `Connected Account: ${connectedAccount}` : 'No Account Connected'}
              </Typography>
              <Button
                className="w-full"
                onClick={handleOpenWallet}
              >
                Test Wallet Connection
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Record Donation</Typography>
              <Button
                className="w-full mb-4"
                onClick={handleApproveUSDC}
              >
                Approve USDC Spending
              </Button>
              <Button
                className="w-full mb-4"
                onClick={handleCheckUSDCBalance}
              >
                Check USDC Balance
              </Button>
              <TextField
                fullWidth
                label="Fundraiser ID"
                type="number"
                value={fundraiserId}
                onChange={handleInputChange(setFundraiserId)}
                sx={{ mb: 2 }}
                inputProps={{
                  min: "0",
                  step: "1"
                }}
              />
              <TextField
                fullWidth
                label="Donation Amount (USDC)"
                type="number"
                value={donationAmount}
                onChange={handleInputChange(setDonationAmount)}
                sx={{ mb: 2 }}
                inputProps={{
                  step: "0.000001",
                  min: "0"
                }}
              />
              <Button
                className="w-full"
                onClick={handleRecordDonation}
              >
                Record Donation
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Check Allowance</Typography>
              <Button
                className="w-full"
                onClick={handleCheckAllowance}
              >
                Check Allowance
              </Button>
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
              <Button
                className="w-full"
                onClick={handleEmergencyWithdraw}
              >
                Emergency Withdraw
              </Button>
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
              <Button
                className="w-full"
                onClick={handleGetAmountInBaseUnits}
              >
                Get Base Units
              </Button>
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