import { useRouter } from 'next/router';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Alert, CircularProgress, Box, Paper, Typography, Container } from '@mui/material';
import { useVerification } from '@/contexts/VerificationContext';

// Multiple RPC providers for better reliability
const RPC_PROVIDERS = [
  "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
  "https://eth-sepolia.g.alchemy.com/v2/demo",
  "https://rpc.sepolia.org",
  "https://rpc2.sepolia.org"
];

// Utility function for delay (for retry logic)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function LendAHand() {
  const router = useRouter();
  const { isVerified } = useVerification();
  
  const [contract, setContract] = useState<Contract | null>(null);
  const [fundraisers, setFundraisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentProvider, setCurrentProvider] = useState<number>(0);

  // Initialize contract with retry across multiple providers
  useEffect(() => {
    const initializeContract = async () => {
      try {
        const contractAddress = "0x308A7629a5C39f9073D4617A4e95A205d4474E07";
        
        // Check for ethereum without trying to modify it
        if (typeof window !== 'undefined') {
          if (window.ethereum) {
            console.log("Found Web3 provider - using BrowserProvider");
            try {
              const provider = new ethers.BrowserProvider(window.ethereum);
              const signer = await provider.getSigner();
              const contractInstance = new Contract(contractAddress, contractABI, signer);
              
              // Check for contract interface
              if (contractInstance.interface) {
                const functionNames: string[] = [];
                for (const fragment of contractInstance.interface.fragments) {
                  if (fragment.type === 'function') {
                    // @ts-ignore
                    functionNames.push(fragment.name);
                  }
                }
                console.log("Available contract functions:", functionNames);
                
                // Check if batchGetFundraisers function exists
                if (!functionNames.includes('batchGetFundraisers')) {
                  console.warn("batchGetFundraisers function not found in contract!");
                  setError("Warning: Contract does not have required functions. Contact support.");
                }
              }
              
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
        setLoading(false);
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
          setCurrentProvider(i);
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
      setLoading(false);
    };

    initializeContract();
  }, []);

  // Fetch fundraisers when contract is ready
  useEffect(() => {
    if (contract) {
      fetchFundraisers();
    }
  }, [contract]);

  // Function to fetch fundraisers using batchGetFundraisers with retry logic
  const fetchFundraisers = async () => {
    console.log('Attempting to fetch fundraisers from blockchain');
    setLoading(true);
    setError('');
    
    try {
      if (!contract) {
        setError('Contract not initialized');
        setLoading(false);
        return;
      }
      
      console.log("Fetching fundraisers using batchGetFundraisers...");
      
      // Retry logic for contract calls
      const maxRetries = 3;
      let batchSuccess = false;
      let batchData = null;
      
      // Try batch loading first
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Get data with IDs from 0 to 50
          console.log(`Calling contract.batchGetFundraisers - Attempt ${attempt}/${maxRetries}`);
          
          const data = await contract.batchGetFundraisers(0, 50);
          console.log("Batch response:", data);
          
          // Check if there's any data
          if (!data || !data.owners || !Array.isArray(data.owners) || data.owners.length === 0) {
            console.log("No fundraisers found or empty response");
            setFundraisers([]);
            setLoading(false);
            return;
          }
          
          batchSuccess = true;
          batchData = data;
          break; // Exit the batch retry loop if successful
          
        } catch (contractErr: any) {
          console.error(`Error calling batchGetFundraisers (attempt ${attempt}/${maxRetries}):`, contractErr);
          
          // Extended diagnostics (only in console)
          console.log("Contract address:", contract.target);
          console.log("Call details:", {
            functionName: 'batchGetFundraisers', 
            params: [0, 50],
            from: contract.runner ? 'connected' : 'not connected'
          });
          
          if (attempt < maxRetries) {
            // If we have more retries, try to switch provider
            if (typeof window !== 'undefined' && !window.ethereum) {
              // Only switch provider if we're using RPC providers (not the user's wallet)
              await tryNextProvider();
            }
            
            // Wait longer between each retry (exponential backoff)
            const backoffTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
            console.log(`Waiting ${backoffTime}ms before retry...`);
            await delay(backoffTime);
            continue;
          }
          
          // If all batch attempts failed, try individual loading
          console.log("All batch loading attempts failed. Trying individual loading...");
          break;
        }
      }
      
      // Transform data into a convenient format
      const processedFundraisers: Array<{
        id: number;
        title: string;
        location: string;
        description: string;
        amountRaised: string;
        imageUrl: string;
        percentComplete: number;
      }> = [];
      
      // If batch loading succeeded, process the batch data
      if (batchSuccess && batchData) {
        console.log("Processing batch response data");
        const failedIds = [];
        
        for (let i = 0; i < batchData.owners.length; i++) {
          // Skip empty or invalid entries
          if (!batchData.owners[i] || batchData.owners[i] === ethers.ZeroAddress) {
            continue;
          }
          
          try {
            // Instead of using contentRegistry, get complete information via getFundraiser
            const fundraiserDetails = await contract.getFundraiser(i);
            console.log(`Detailed fundraiser #${i}:`, fundraiserDetails);
            
            // Get title and description from getFundraiser response
            const title = fundraiserDetails[3] || `Fundraiser #${i}`;
            const description = fundraiserDetails[4] || '';
            
            // Choose a random image for visual representation
            const imageId = Math.floor(Math.random() * 1000);
            
            // Format values
            const amountNeeded = parseFloat(ethers.formatUnits(fundraiserDetails[5], 6));
            const amountCollected = parseFloat(ethers.formatUnits(fundraiserDetails[6], 6));
            
            // Form an object with fundraising data
            processedFundraisers.push({
              id: i,
              title: title || `Fundraiser #${i}`,
              location: 'Blockchain', // Can add location retrieval if available
              description: description || `Goal: $${formatUSDC(amountNeeded)}`,
              amountRaised: `$${formatUSDC(amountCollected)} USD`,
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${imageId}`,
              percentComplete: amountNeeded > 0 ? Math.min(100, (amountCollected / amountNeeded) * 100) : 0
            });
          } catch (processingErr) {
            // Log technical details to console
            console.error(`Error processing fundraiser ${i}:`, processingErr);
            // Remember failed IDs for individual retry
            failedIds.push(i);
          }
        }
        
        // Try loading failed IDs individually
        if (failedIds.length > 0) {
          console.log(`Attempting to load ${failedIds.length} failed fundraisers individually...`);
          await loadFundraisersIndividually(failedIds, processedFundraisers);
        }
        
      } else {
        // Batch loading completely failed, try individual loading for first few fundraisers
        console.log("Falling back to individual fundraiser loading");
        // Try loading the first 10 fundraisers individually as a fallback
        await loadFundraisersIndividually([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], processedFundraisers);
      }
      
      console.log(`Processed ${processedFundraisers.length} valid fundraisers`);
      setFundraisers(processedFundraisers);
      setLoading(false);
      
    } catch (err: any) {
      // Log technical details to console for debugging
      console.error('Error loading fundraisers from blockchain:', err);
      
      // Log contract details for debugging
      if (contract) {
        console.log('Contract address:', await contract.getAddress());
        
        // Try to get contract status for debugging
        try {
          const status = await contract.getContractStatus();
          console.log('Contract status:', status);
        } catch (statusErr) {
          console.log('Unable to get contract status:', statusErr);
        }
      }
      
      // Show technical details in console but user-friendly message on screen
      if (err.message && err.message.includes('missing revert data')) {
        console.warn('Detected "missing revert data" error - this might indicate contract problems or incorrect parameters');
        setError("Couldn't parse contract data, please click the refresh button.");
      } else if (err.code && err.code === 'NETWORK_ERROR') {
        setError("Network connection error. Please check your internet connection and try again.");
      } else {
        setError("We're having trouble connecting to the blockchain. Please try refreshing the page or check your internet connection.");
      }
      setFundraisers([]);
      setLoading(false);
    }
  };

  // Helper function to load fundraisers individually with retry logic
  const loadFundraisersIndividually = async (ids: number[], collection: Array<{
    id: number;
    title: string;
    location: string;
    description: string;
    amountRaised: string;
    imageUrl: string;
    percentComplete: number;
  }>) => {
    if (!contract) return;
    
    for (const id of ids) {
      // Skip if we already have this fundraiser in our collection
      if (collection.some(item => item.id === id)) {
        continue;
      }
      
      let success = false;
      
      // Try up to 2 times for each individual fundraiser
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`Loading individual fundraiser #${id} - Attempt ${attempt}/2`);
          
          const fundraiserDetails = await contract.getFundraiser(id);
          
          // Skip if invalid or empty
          if (!fundraiserDetails || !fundraiserDetails[0]) {
            console.log(`Fundraiser #${id} is invalid or empty`);
            break;
          }
          
          console.log(`Loaded fundraiser #${id} successfully:`, fundraiserDetails);
          
          // Get title and description from getFundraiser response
          const title = fundraiserDetails[3] || `Fundraiser #${id}`;
          const description = fundraiserDetails[4] || '';
          
          // Choose a random image for visual representation
          const imageId = Math.floor(Math.random() * 1000);
          
          // Format values
          const amountNeeded = parseFloat(ethers.formatUnits(fundraiserDetails[5], 6));
          const amountCollected = parseFloat(ethers.formatUnits(fundraiserDetails[6], 6));
          
          // Form an object with fundraising data
          collection.push({
            id: id,
            title: title || `Fundraiser #${id}`,
            location: 'Blockchain', // Can add location retrieval if available
            description: description || `Goal: $${formatUSDC(amountNeeded)}`,
            amountRaised: `$${formatUSDC(amountCollected)} USD`,
            imageUrl: `https://source.unsplash.com/random/800x600?sig=${imageId}`,
            percentComplete: amountNeeded > 0 ? Math.min(100, (amountCollected / amountNeeded) * 100) : 0
          });
          
          success = true;
          break; // Exit retry loop for this ID if successful
          
        } catch (err) {
          console.error(`Error loading fundraiser #${id} individually (attempt ${attempt}/2):`, err);
          
          if (attempt < 2) {
            // Wait between retries
            await delay(1000);
          }
        }
      }
      
      if (!success) {
        console.log(`Failed to load fundraiser #${id} after multiple attempts, skipping...`);
      }
    }
  };

  // Try the next RPC provider if current one fails
  const tryNextProvider = async () => {
    if (!contract) return;
    
    const contractAddress = await contract.getAddress();
    const nextProvider = (currentProvider + 1) % RPC_PROVIDERS.length;
    
    try {
      console.log(`Switching to provider ${nextProvider + 1}/${RPC_PROVIDERS.length}: ${RPC_PROVIDERS[nextProvider]}`);
      const provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[nextProvider]);
      
      // Test the provider with a simple call
      await provider.getBlockNumber();
      
      const contractInstance = new Contract(contractAddress, contractABI, provider);
      setContract(contractInstance);
      setCurrentProvider(nextProvider);
      console.log(`Successfully switched to provider ${nextProvider + 1}`);
      return true;
    } catch (err) {
      console.error(`Failed to switch to provider ${nextProvider + 1}:`, err);
      return false;
    }
  };

  // Helper function to format USDC values
  const formatUSDC = (value: any): string => {
    if (!value) return '0.00';
    
    // Convert to number if it's not already
    let numValue;
    try {
      // Parse the value - might be a BigInt or string
      numValue = typeof value === 'string' 
        ? parseFloat(value) 
        : typeof value === 'bigint' 
          ? Number(value) / 1000000 // USDC has 6 decimals
          : Number(value);
          
      // If the value is too small, it might be in base units
      if (numValue > 0 && numValue < 0.01) {
        numValue = numValue * 1000000; // Convert from base units
      }
      
      return numValue.toFixed(2);
    } catch (err) {
      console.error("Error formatting USDC value:", err);
      return '0.00';
    }
  };

  // Helper function to get mock fundraisers - сохраняем для возможного будущего использования
  const getMockFundraisers = () => {
    return [
      {
        id: 1,
        title: "Need Help Moving Furniture",
        location: "Denver, CO",
        description: "Looking for assistance moving heavy furniture to my new apartment",
        amountRaised: "$100 USD",
        imageUrl: "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&q=80"
      },
      {
        id: 2,
        title: "Senior Needs Grocery Shopping Assistance",
        location: "Boulder, CO",
        description: "Elderly person needs weekly help with grocery shopping",
        amountRaised: "$2103 USD",
        imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80"
      },
      {
        id: 3,
        title: "Garden Maintenance Help",
        location: "Fort Collins, CO",
        description: "Need help maintaining community garden for local food bank",
        amountRaised: "$400 USD",
        imageUrl: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80"
      }
    ];
  };

  const handleCardClick = (id: number) => {
    router.push(`/helprequest?helpRequestId=${id}`);
  };

  const handleAskForHelp = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/helprequest');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>Lend a Hand - Help Requests</title>
        <meta
          content="Browse and respond to help requests on the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={handleAskForHelp} />

      <main className="container mx-auto py-8">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
          Browse open help requests
        </h1>
        
        {/* Add error alert with image */}
        {error && (
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
                  Connection Error
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {error}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Button 
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-primary"
              >
                Refresh Page
              </Button>
            </Box>
          </Paper>
        )}
        
        {/* Show loading indicator */}
        {loading && (
          <div className="flex justify-center py-16">
            <CircularProgress color="success" />
          </div>
        )}
        
        {/* Show message if there are no fundraisers */}
        {!loading && !error && fundraisers.length === 0 && (
          <Paper sx={{ p: 3, mt: 3, borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              No Active Fundraisers
            </Typography>
            <Typography variant="body1">
              There are currently no active fundraisers. Check back later or create your own!
            </Typography>
          </Paper>
        )}
        
        {/* Show fundraiser cards */}
        {!loading && fundraisers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fundraisers.map((request) => (
              <Card 
                key={request.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-300"
                onClick={() => handleCardClick(request.id)}
              >
                <div className="aspect-video relative">
                  <img 
                    src={request.imageUrl} 
                    alt={request.title}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute bottom-0 left-0 p-2 bg-black/50 text-white">
                    {request.location}
                  </div>
                </div>
                
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-2">{request.title}</h2>
                  <p className="text-gray-600 mb-4 line-clamp-2">{request.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 font-semibold">{request.amountRaised} raised</span>
                    <Button 
                      variant="outline"
                      className="hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(request.id);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
