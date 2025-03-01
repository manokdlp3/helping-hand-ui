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

  // Initialize contract instance
  useEffect(() => {
    const initializeContract = async () => {
      const contractAddress = "0x308A7629a5C39f9073D4617A4e95A205d4474E07";
      
      // Fix the ethereum property issue - we need to handle this safely
      if (typeof window !== 'undefined') {
        try {
          // Check if ethereum is available without trying to set it
          if (window.ethereum) {
            console.log("Found Web3 provider - using BrowserProvider");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contractInstance = new Contract(contractAddress, contractABI, signer);
            setContract(contractInstance);
          } else {
            // Fallback to read-only if ethereum is not available
            console.log("No Web3 provider found - using read-only provider");
            const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
            const contractInstance = new Contract(contractAddress, contractABI, provider);
            setContract(contractInstance);
          }
        } catch (err) {
          console.error('Error initializing contract:', err);
          // Provide a more user-friendly error message
          setError('Failed to initialize contract. Please make sure your wallet is connected.');
          
          // Try with read-only provider as a fallback
          try {
            console.log("Falling back to read-only provider");
            const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
            const contractInstance = new Contract(contractAddress, contractABI, provider);
            setContract(contractInstance);
          } catch (fallbackErr) {
            console.error('Error with fallback provider:', fallbackErr);
          }
        }
      } else {
        // Server-side rendering case
        console.log("Server-side rendering detected - deferring contract initialization");
      }
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
    console.log(`Fetching fundraiser data for ID ${id}`);
    
    try {
      if (!contract) {
        setError('Contract not initialized');
        setIsLoading(false);
        return;
      }
      
      if (!id || id === '') {
        setError('Invalid fundraiser ID');
        setIsLoading(false);
        return;
      }
      
      // Call contract to get fundraiser data
      try {
        const data = await contract.getFundraiser(id);
        console.log(`Raw fundraiser data for ID ${id}:`, data);
        
        // Check if we have actual data (sometimes the contract returns empty data)
        if (!data || !data[3]) { // subject is at index 3
          setError(`Fundraiser #${id} not found. This fundraiser either doesn't exist or has been removed.`);
          setIsLoading(false);
          return;
        }
        
        // Process and format data
        const amountNeededRaw = parseFloat(ethers.formatUnits(data[5], 6));
        const amountCollectedRaw = parseFloat(ethers.formatUnits(data[6], 6));
        
        // Create formatted result object
        const formatted = {
          id: id, // Use the ID that was passed to this function
          owner: data[0],
          startDate: new Date(Number(data[1]) * 1000).toLocaleDateString(),
          endDate: new Date(Number(data[2]) * 1000).toLocaleDateString(),
          subject: data[3],
          additionalDetails: data[4],
          amountNeededRaw,
          amountCollectedRaw,
          amountNeeded: formatUSDC(amountNeededRaw),
          amountCollected: formatUSDC(amountCollectedRaw),
          isCompleted: data[7],
          goalReached: data[8]
        };
        
        console.log(`Formatted fundraiser data for ID ${id}:`, formatted);
        setResult(formatted);
      } catch (contractErr: any) {
        console.error(`Contract error for fundraiser ${id}:`, contractErr);
        // This is specifically for handling the "missing revert data" error
        if (contractErr.message && contractErr.message.includes('missing revert data')) {
          setError(`Fundraiser #${id} not found. The fundraiser does not exist on the blockchain.`);
        } else {
          setError(`Error loading fundraiser #${id}: ${contractErr.message || 'Contract error'}`);
        }
      }
      
    } catch (err: any) {
      console.error(`Error getting fundraiser ${id}:`, err);
      
      if (err.message && (
        err.message.includes('reverted') || 
        err.message.includes('invalid BigInt') || 
        err.message.includes('out of bounds') || 
        err.message.includes('missing revert data')
      )) {
        setError(`Fundraiser #${id} not found. This fundraiser either doesn't exist or has been removed.`);
      } else {
        setError(`Unable to load fundraiser: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
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
      fetchFundraiserData(currentFundraiserId);
      
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
                    <strong>Start:</strong> {result.startDate}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>End:</strong> {result.endDate}
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
                      {result.additionalDetails}
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
                    {result.amountCollected}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      collected of {result.amountNeeded}
                    </Typography>
                    
                    {/* Progress Bar */}
                    <Box sx={{ width: '100%', mb: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={(() => {
                          // Безопасный расчет процента выполнения
                          if (!result.amountNeededRaw || result.amountNeededRaw <= 0) return 0;
                          const percent = (result.amountCollectedRaw / result.amountNeededRaw) * 100;
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
                          if (!result.amountNeededRaw || result.amountNeededRaw <= 0) return '0';
                          const percent = Math.round((result.amountCollectedRaw / result.amountNeededRaw) * 100);
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
            <Typography variant="h6" sx={{ color: 'error.main' }} gutterBottom>
              Fundraiser Not Found
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {error || `No data found for fundraiser #${router.query.helpRequestId}. The fundraiser may not exist.`}
            </Typography>
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
      </Container>

      <Footer />
    </div>
  );
};

export default HelpRequestPage; 