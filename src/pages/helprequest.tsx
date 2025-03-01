import { useState, useEffect, ChangeEvent } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, TextField, Typography, Container, Paper, Grid, LinearProgress, CircularProgress, Alert } from '@mui/material';
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

// Multiple RPC providers for better reliability
const RPC_PROVIDERS = [
  "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  "https://eth-sepolia.g.alchemy.com/v2/demo",
  "https://rpc.sepolia.org",
  "https://rpc2.sepolia.org"
];

// Utility function for delay (for retry logic)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const HelpRequestPage = () => {
  const [contract, setContract] = useState<Contract | null>(null);
  const { isVerified } = useVerification();
  
  // Form states
  const [fundraiserId, setFundraiserId] = useState<string>('0');
  const [showDonationInput, setShowDonationInput] = useState(false);
  const [donationAmount, setDonationAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
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

  // Initialize contract with multiple providers and retry logic
  useEffect(() => {
    const initializeContract = async () => {
      try {
        const contractAddress = "0x308A7629a5C39f9073D4617A4e95A205d4474E07";
        
        if (typeof window !== 'undefined') {
          if (window.ethereum) {
            console.log("Found Web3 provider - using BrowserProvider");
            try {
              const provider = new ethers.BrowserProvider(window.ethereum);
              const signer = await provider.getSigner();
              const contractInstance = new Contract(contractAddress, contractABI, signer);
              setContract(contractInstance);
            } catch (signerErr) {
              console.error("Error getting signer:", signerErr);
              
              // If failed to get signer, use read-only mode with fallback providers
              await connectWithFallbackProviders(contractAddress);
            }
          } else {
            // Use read-only provider with fallback if ethereum is not available
            console.log("No Web3 provider found - using read-only provider");
            await connectWithFallbackProviders(contractAddress);
          }
        }
      } catch (err) {
        console.error('Error initializing contract:', err);
        setError('Failed to initialize contract. Please check your connection.');
        setIsLoading(false);
      }
    };

    // Function to try connecting with multiple providers
    const connectWithFallbackProviders = async (contractAddress: string) => {
      // Try each provider in sequence
      for (let i = 0; i < RPC_PROVIDERS.length; i++) {
        try {
          console.log(`Trying provider ${i+1}/${RPC_PROVIDERS.length}: ${RPC_PROVIDERS[i]}`);
          const provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[i]);
          
          // Test the provider with a simple call
          await provider.getBlockNumber();
          
          const contractInstance = new Contract(contractAddress, contractABI, provider);
          setContract(contractInstance);
          console.log(`Successfully connected using provider ${i+1}`);
          return; // Exit if successful
        } catch (providerErr) {
          console.error(`Provider ${i+1} failed:`, providerErr);
          // Continue to next provider
        }
      }
      
      // If all providers failed
      console.error("All providers failed to connect");
      setError("Failed to connect to blockchain network. Please check your internet connection.");
      setIsLoading(false);
    };

    initializeContract();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    // Wait for contract to be loaded
    if (!contract) return;
    
    const { helpRequestId } = router.query;
    console.log("URL params changed:", helpRequestId);
    
    // Remove redirection from ID 0 to ID 1
    // Keep this comment as explanation but remove the actual redirection
    
    if (helpRequestId && typeof helpRequestId === 'string') {
      console.log("Processing helpRequestId:", helpRequestId);
      
      // IMPORTANT: Update fundraiserId state immediately
      setFundraiserId(helpRequestId);
      
      // Reset previous data
      setResult(null);
      setError('');
      setIsLoading(true);
      
      // Directly fetch fundraiser with the ID from URL, don't use state variable
      // which might not be updated yet due to React state batching
      setTimeout(() => {
        fetchFundraiserData(helpRequestId);
      }, 50);
    }
  }, [router.query, contract]); // Depend on both router.query and contract

  // Separate function to fetch fundraiser data by ID
  const fetchFundraiserData = async (id: string) => {
    setIsLoading(true);
    setError('');
    
    if (!contract) {
      setError("Contract not initialized. Please try again later.");
      setIsLoading(false);
      return;
    }
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Calling contract.getFundraiser - Attempt ${attempt}/${maxRetries}`);
        const result = await contract.getFundraiser(id);
        console.log("Fundraiser result:", result);
        
        // Process fundraiser data
        const owner = result[0];
        const startDate = new Date(Number(result[1]) * 1000);
        const endDate = new Date(Number(result[2]) * 1000);
        const subject = result[3];
        const details = result[4];
        const goal = parseFloat(ethers.formatUnits(result[5], 6));
        const amountRaised = parseFloat(ethers.formatUnits(result[6], 6));
        const isCompleted = result[7];
        const goalReached = result[8];
        
        setResult({
          id: Number(id),
          owner,
          startDate,
          endDate,
          subject,
          details,
          goal,
          amountRaised,
          isCompleted,
          goalReached
        });
        
        setIsLoading(false);
        return; // Success! Exit the retry loop
      } catch (contractErr: any) {
        console.error(`Error fetching fundraiser (attempt ${attempt}/${maxRetries}):`, contractErr);
        
        if (attempt < maxRetries) {
          // Wait longer between each retry (exponential backoff)
          const backoffTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.log(`Waiting ${backoffTime}ms before retry...`);
          await delay(backoffTime);
          
          // Try with a different provider if not using wallet provider
          if (typeof window !== 'undefined' && !window.ethereum) {
            await tryNextProvider(contract?.target as string);
          }
          
          continue;
        }
        
        // Log technical details to console, but show user-friendly message
        if (contractErr.message && contractErr.message.includes('missing revert data')) {
          setError(`Couldn't parse contract data, please click the refresh button.`);
        } else {
          setError(`We're having trouble connecting to the blockchain. Please try refreshing the page.`);
        }
        
        setIsLoading(false);
      }
    }
  };
  
  // Try the next RPC provider if current one fails
  const tryNextProvider = async (contractAddress: string) => {
    if (!contractAddress) return false;
    
    for (let i = 0; i < RPC_PROVIDERS.length; i++) {
      try {
        console.log(`Trying alternative provider ${i+1}/${RPC_PROVIDERS.length}`);
        const provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[i]);
        
        // Test the provider with a simple call
        await provider.getBlockNumber();
        
        // Create new contract instance with this provider
        const contractInstance = new Contract(contractAddress, contractABI, provider);
        setContract(contractInstance);
        console.log(`Successfully switched to provider ${i+1}`);
        return true;
      } catch (err) {
        console.error(`Failed to use provider ${i+1}:`, err);
      }
    }
    
    return false;
  };

  // Update handleGetFundraiser to use fetchFundraiserData
  const handleGetFundraiser = async () => {
    setIsLoading(true);
    setError('');
    await fetchFundraiserData(fundraiserId);
  };

  // Добавляем обработчик изменения URL при выборе другого ID
  const navigateToFundraiser = (id: string) => {
    // Remove ID 0 to ID 1 redirection
    // Keep IDs as they are without remapping
    
    // Предотвращаем повторную навигацию к тому же ID
    if (id === fundraiserId && result && result.id === id) {
      return;
    }
    
    console.log(`Navigating from fundraiser ${fundraiserId} to ${id}`);
    
    // Полностью сбрасываем состояние
    setResult(null);
    setError('');
    setIsLoading(true);
    
    // Устанавливаем ID перед навигацией
    setFundraiserId(id);
    
    // Используем полный URL для предотвращения проблем с портом
    const baseUrl = window.location.origin;
    window.location.href = `${baseUrl}/helprequest?helpRequestId=${id}`;
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
    router.push('/helpme');
  };

  const handleDonationSubmit = async () => {
    setIsSubmitting(true);
    setDonationError('');
    
    try {
      // Safe check for ethereum
      const hasWallet = typeof window !== 'undefined' && window.ethereum;
      if (!hasWallet) {
        setDonationError('Web3 wallet like MetaMask is required');
        setIsSubmitting(false);
        return;
      }
      
      if (!contract) {
        setDonationError('Contract not initialized');
        setIsSubmitting(false);
        return;
      }
      
      if (!donationAmount || parseFloat(donationAmount) <= 0) {
        setDonationError('Please enter a valid amount');
        setIsSubmitting(false);
        return;
      }

      if (!result || !result.id) {
        setDonationError('No active fundraiser loaded');
        setIsSubmitting(false);
        return;
      }
      
      // Get the current fundraiser ID from the result object
      const currentFundraiserId = result.id;
      console.log(`Processing donation for fundraiser #${currentFundraiserId}`);
      
      // Check if user has USDC balance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // Check USDC balance
      const userUsdcBalance = await usdcContract.balanceOf(userAddress);
      const donationAmountInBaseUnits = ethers.parseUnits(donationAmount, 6); // USDC has 6 decimals
      
      if (userUsdcBalance < donationAmountInBaseUnits) {
        setDonationError(`Insufficient USDC balance. You have ${ethers.formatUnits(userUsdcBalance, 6)} USDC`);
        setIsSubmitting(false);
        return;
      }
      
      // If we're donating to fundraiser that's already beyond goal, show warning
      if (result && result.amountCollectedRaw && result.amountNeededRaw) {
        const remainingToGoal = parseFloat(result.amountNeededRaw) - parseFloat(result.amountCollectedRaw);
        if (remainingToGoal <= 0) {
          setDonationError('This fundraiser has already reached its goal!');
          setIsSubmitting(false);
          return;
        }
        
        // Check if donation exceeds the remaining amount
        if (parseFloat(donationAmount) > remainingToGoal) {
          setDonationError(`This donation exceeds the remaining goal amount by $${(parseFloat(donationAmount) - remainingToGoal).toFixed(2)}`);
          setIsSubmitting(false);
          return;
        }
      }
      
      // First, approve the contract to spend USDC
      console.log(`Approving ${donationAmount} USDC for contract at ${contract.target}`);
      const tx1 = await usdcContract.approve(contract.target, donationAmountInBaseUnits);
      await tx1.wait();
      
      // Then, call the contract function to record donation
      console.log(`Recording donation of ${donationAmount} USDC to fundraiser #${currentFundraiserId}`);
      const tx2 = await contract.recordDonation(currentFundraiserId, ethers.parseUnits(donationAmount, 6));
      await tx2.wait();
      
      console.log('Donation successful! Refreshing fundraiser data.');
      
      // Reset state and refresh fundraiser data
      setDonationAmount('');
      setShowDonationInput(false);
      
      // Refresh the current fundraiser data
      fetchFundraiserData(currentFundraiserId.toString());
      
    } catch (err: any) {
      console.error('Donation error:', err);
      setDonationError(err.message || 'Failed to process donation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Правильное форматирование USDC значений с $
  const formatUSDCValue = (value: number): string => {
    // Ensure value is valid and not NaN
    if (isNaN(value)) {
      console.warn("Attempted to format NaN value as USDC");
      return "$0.00";
    }
    return `$${value.toFixed(2)}`;
  };

  // Обработка форматирования всех USDC значений
  const formatUSDC = (value: string | number): string => {
    if (!value) return '$0.00';
    
    // Преобразуем в число
    let numericValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Handle invalid numbers
    if (isNaN(numericValue)) {
      console.warn("Invalid numeric value in formatUSDC:", value);
      return '$0.00';
    }
    
    // Проверяем на очень маленькие значения (< 0.01), такие значения могут быть в базовых единицах USDC
    if (numericValue > 0 && numericValue < 0.01) {
      // Умножаем на 1,000,000 для конвертации из базовых единиц
      numericValue = numericValue * 1000000;
      console.log(`Converted small USDC value: ${value} → ${numericValue}`);
    }
    
    // Возвращаем отформатированное значение с $
    return formatUSDCValue(numericValue);
  };

  // Add a useEffect to log the current port
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log(`Current URL: ${window.location.href}`);
      console.log(`Current port: ${window.location.port}`);
      console.log(`Current origin: ${window.location.origin}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Lend a Hand - Fundraiser Details</title>
        <meta
          content="View fundraiser details and donate to help others in need"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={handleAskForHelp} />

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Отображение ошибок */}
        {error && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'error.main', color: 'white' }}>
            <Typography variant="h6">Error</Typography>
            <Typography>{error}</Typography>
            <Box sx={{ mt: 2 }}>
              <Button 
                onClick={() => {
                  console.log("Redirecting to fundraiser #0");
                  // Reset states
                  setResult(null);
                  setError('');
                  // Use the baseUrl to preserve the port
                  const baseUrl = window.location.origin;
                  console.log(`Redirecting to: ${baseUrl}/helprequest?helpRequestId=0`);
                  window.location.href = `${baseUrl}/helprequest?helpRequestId=0`;
                }}
                className="bg-primary"
              >
                Go to Fundraiser #0
              </Button>
            </Box>
          </Paper>
        )}

        {/* Форма поиска сбора средств */}
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
                onClick={() => navigateToFundraiser(fundraiserId)}
              >
                Get Fundraiser Details
              </Button>
            </Box>
          </Paper>
        )}

        {/* Отображение данных сбора средств */}
        {result && (
          <>
            {/* Кнопки навигации между сборами средств */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                onClick={() => {
                  if (result && result.id) {
                    // Allow navigation to ID 0 now
                    const prevId = parseInt(result.id) - 1;
                    if (prevId >= 0 && prevId.toString() !== result.id) {
                      console.log(`Going to previous: ${prevId} from current ${result.id}`);
                      navigateToFundraiser(prevId.toString());
                    }
                  }
                }}
                disabled={result.id === "0" || isLoading}
                className="bg-primary"
              >
                &larr; Previous
              </Button>
              
              {/* Display current ID instead of empty placeholder */}
              <Typography variant="body1" sx={{ py: 1, px: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                ID: {result.id}
              </Typography>
              
              <Button
                onClick={() => {
                  if (result && result.id) {
                    const nextId = parseInt(result.id) + 1;
                    console.log(`Going to next: ${nextId} from current ${result.id}`);
                    navigateToFundraiser(nextId.toString());
                  }
                }}
                disabled={isLoading}
                className="bg-primary"
              >
                Next &rarr;
              </Button>
            </Box>
          
            <Grid container spacing={4}>
              {/* Left Column */}
              <Grid item xs={12} md={8}>
                <Typography variant="h4" gutterBottom>
                  {result.subject}
                </Typography>
                
                {/* Улучшенный Placeholder для изображения */}
                <Box 
                  sx={{ 
                    width: '100%', 
                    height: 300, 
                    bgcolor: 'grey.200', 
                    mb: 3,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'grey.500'
                  }} 
                >
                  <Typography variant="body1">
                    Fundraiser Image
                  </Typography>
                </Box>

                <Paper elevation={1} sx={{ p: 3, mb: 4, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <strong>Organizer:</strong> {result.owner}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Start:</strong> {result.startDate.toLocaleDateString()}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>End:</strong> {result.endDate.toLocaleDateString()}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Status:</strong> {result.isCompleted ? 'Completed' : 'Active'} 
                    {result.goalReached && ' (Goal Reached)'}
                  </Typography>
                </Paper>

                {/* Description box with styled title */}
                <Paper elevation={2} sx={{ p: 0, mb: 3, overflow: 'hidden' }}>
                  <Box sx={{ 
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    p: 2,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4
                  }}>
                    <Typography variant="h6" sx={{ m: 0 }}>
                      Description
                    </Typography>
                  </Box>
                  
                  <Box sx={{ p: 3 }}>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {result.details}
                    </Typography>
                  </Box>
                </Paper>
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
                    {formatUSDC(result.amountRaised)}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      collected of {formatUSDC(result.goal)}
                    </Typography>
                    
                    {/* Progress Bar */}
                    <Box sx={{ width: '100%', mb: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={(() => {
                          // Безопасный расчет процента выполнения
                          if (!result.goal || result.goal <= 0) return 0;
                          const percent = (result.amountRaised / result.goal) * 100;
                          return isNaN(percent) ? 0 : Math.min(percent, 100);
                        })()}
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
                        {(() => {
                          // Безопасный расчет процента выполнения для текста
                          if (!result.goal || result.goal <= 0) return '0';
                          const percent = Math.round((result.amountRaised / result.goal) * 100);
                          return isNaN(percent) ? '0' : percent;
                        })()}% completed
                      </Typography>
                    </Box>
                  </Box>

                  {!result.isCompleted && (
                    <>
                      {showDonationInput && (
                        <>
                          <TextField
                            fullWidth
                            label="How much USDC?"
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
                        disabled={isSubmitting || !window.ethereum}
                      >
                        {isSubmitting ? 'Processing...' : (showDonationInput ? 'Donate' : 'Help')}
                      </Button>

                      {!window.ethereum && (
                        <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                          A Web3 wallet like MetaMask is required for donations
                        </Typography>
                      )}
                    </>
                  )}
                  
                  {donationError && (
                    <Typography color="error" sx={{ mt: 2 }}>
                      {donationError}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}

        {/* Индикатор загрузки */}
        {router.query.helpRequestId && !result && !error && isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8, flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" gutterBottom>Loading fundraiser data...</Typography>
            <LinearProgress sx={{ width: '50%', mt: 2 }} />
          </Box>
        )}
        
        {/* Remove duplicate not found section and merge with error display */}
        {(error || (router.query.helpRequestId && !result && !isLoading)) && (
          <Paper 
            sx={{ 
              p: 3, 
              mt: 3, 
              mb: 3, 
              borderRadius: 2,
              border: '1px solid #f44336',
              backgroundColor: '#ffebee'
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: {xs: 'column', sm: 'row'}, alignItems: 'center', mb: 2 }}>
              <Box sx={{ mr: 2, mb: {xs: 2, sm: 0}, textAlign: {xs: 'center', sm: 'left'} }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="#f44336" />
                </svg>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: 'error.main' }} gutterBottom>
                  Fundraiser Not Found
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {error}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-primary"
              >
                Refresh Page
              </Button>
              <Button 
                onClick={() => {
                  navigateToFundraiser('0');
                }}
                variant="outline"
                className="border-primary text-primary"
              >
                Go to Fundraiser #0
              </Button>
            </Box>
          </Paper>
        )}
      </Container>

      <Footer />
    </div>
  );
};

export default HelpRequestPage; 
