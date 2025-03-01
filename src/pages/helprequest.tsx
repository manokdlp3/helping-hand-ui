import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Box, TextField, Typography, Container, Paper, Grid, LinearProgress, CircularProgress, Alert } from '@mui/material';
import usdcABI from '../../abi/testnet/usdc-abi.json';
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
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://gateway.tenderly.co/public/sepolia",
  "https://rpc.sepolia.ethpandaops.io",
  "https://sepolia.gateway.tenderly.co"
];

// Delay helper for retries
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

  // USDC contract address
  const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

  // Result states
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [donationError, setDonationError] = useState<string>('');

  const router = useRouter();

  // ============================
  //   Initialize Contract
  // ============================
  const connectWithFallbackProviders = (contractAddress: string) => {
    for (let i = 0; i < RPC_PROVIDERS.length; i++) {
      try {
        console.log(`Trying provider ${i+1}/${RPC_PROVIDERS.length}: ${RPC_PROVIDERS[i]}`);
        const provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[i]);
        provider.getBlockNumber()
          .then(() => {
            const contractInstance = new Contract(contractAddress, contractABI, provider);
            setContract(contractInstance);
            console.log(`Successfully connected using provider ${i+1}`);
            return;
          })
          .catch((error) => {
            console.error(`Provider test failed:`, error);
          });
      } catch (providerErr) {
        console.error(`Provider ${i+1} failed:`, providerErr);
      }
    }
    console.error("All providers failed to connect");
    setError("Failed to connect to blockchain network. Please check your internet connection.");
    setIsLoading(false);
  };

  useEffect(() => {
    const initializeContract = () => {
      try {
        const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as string;
        if (typeof window !== 'undefined') {
          if (window.ethereum) {
            console.log("Found Web3 provider - using BrowserProvider");
            try {
              const provider = new ethers.BrowserProvider(window.ethereum);
              provider.getSigner()
                .then(signer => {
                  const contractInstance = new Contract(contractAddress, contractABI, signer);
                  setContract(contractInstance);
                })
                .catch(signerErr => {
                  console.error("Error getting signer:", signerErr);
                  connectWithFallbackProviders(contractAddress);
                });
            } catch (providerErr) {
              console.error("Error creating provider:", providerErr);
              connectWithFallbackProviders(contractAddress);
            }
          } else {
            console.log("No Web3 provider found - using read-only provider");
            connectWithFallbackProviders(contractAddress);
          }
        }
      } catch (err) {
        console.error('Error initializing contract:&apos;', err);
        setError('Failed to initialize contract. Please check your connection.');
        setIsLoading(false);
      }
    };

    initializeContract();
  }, []);

  // ===================================
  //    Fetch Fundraiser Data / Retry
  // ===================================
  const fetchFundraiserData = (id: string) => {
    setIsLoading(true);
    setError('');

    if (!contract) {
      setError("Contract not initialized. Please try again later.");
      setIsLoading(false);
      return;
    }

    const maxRetries = 3;
    let attempt = 1;

    const tryFetch = () => {
      console.log(`Calling contract.getFundraiser - Attempt ${attempt}/${maxRetries}`);
      contract.getFundraiser(id)
        .then(result => {
          console.log("Fundraiser result:", result);
          /**
           * We see logs like:
           * 0: '0xDA917e14c9BC38d...'
           * 1: 1740779640n  <-- some bigInt
           * 2: 1772329580000n
           * 3: 'test'
           * 4: 'test'
           * 5: 4n    // goal in final USDC (NOT base units)
           * 6: 5n    // amountRaised in final USDC (NOT base units)
           * 7: true
           * 8: true
           */

          const owner = result[0];
          // parse start/end times
          const startDate = new Date(Number(result[1]) * 1000);
          const endDate = new Date(Number(result[2]) * 1000);

          const subject = result[3];
          const details = result[4];

          // Because your logs show result[5] & [6] are already final USDC amounts (e.g. 4, 5)
          // we do NOT call ethers.formatUnits(...) here. 
          // Instead, treat them as whole-dollar amounts:
          const goalUSDC = Number(result[5]);         // e.g. 4
          const amountRaisedUSDC = Number(result[6]); // e.g. 5

          const isCompleted = result[7];
          const goalReached = result[8];

          setResult({
            id: Number(id),
            owner,
            startDate,
            endDate,
            subject,
            details,
            goal: goalUSDC,            // e.g. 4 means "4 USDC"
            amountRaised: amountRaisedUSDC,  // e.g. 5 means "5 USDC"
            isCompleted,
            goalReached
          });

          setIsLoading(false);
        })
        .catch(contractErr => {
          console.error(`Error fetching fundraiser (attempt ${attempt}/${maxRetries}):`, contractErr);

          if (attempt < maxRetries) {
            const backoffTime = Math.pow(2, attempt) * 1000;
            console.log(`Waiting ${backoffTime}ms before retry...`);
            delay(backoffTime)
              .then(() => {
                if (typeof window !== 'undefined' && !window.ethereum) {
                  tryNextProvider(contract?.target as string)
                    .then(() => {
                      attempt++;
                      tryFetch();
                    })
                    .catch(() => {
                      attempt++;
                      tryFetch();
                    });
                } else {
                  attempt++;
                  tryFetch();
                }
              });
          } else {
            if (contractErr.message && contractErr.message.includes('missing revert data')) {
              setError(`Couldn't parse contract data, please click the refresh button.`);
            } else {
              setError(`We're having trouble connecting to the blockchain. Please try refreshing the page.`);
            }
            setIsLoading(false);
          }
        });
    };

    tryFetch();

  };

  // Switch to next provider if needed
  const tryNextProvider = (contractAddress: string) => {
    if (!contractAddress) return Promise.reject(false);

    return new Promise((resolve, reject) => {
      let attempted = 0;
      const tryProvider = (index: number) => {
        if (index >= RPC_PROVIDERS.length) {
          reject(false);
          return;
        }
        try {
          console.log(`Trying alternative provider ${index+1}/${RPC_PROVIDERS.length}`);
          const provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[index]);
          provider.getBlockNumber()
            .then(() => {
              const contractInstance = new Contract(contractAddress, contractABI, provider);
              setContract(contractInstance);
              console.log(`Successfully switched to provider ${index+1}`);
              resolve(true);
            })
            .catch(err => {
              console.error(`Failed to use provider ${index+1}:`, err);
              tryProvider(index + 1);
            });
        } catch (err) {
          console.error(`Failed to initialize provider ${index+1}:`, err);
          tryProvider(index + 1);
        }
      };
      tryProvider(0);
    });
  };

  // Handle manual search
  const handleGetFundraiser = () => {
    setIsLoading(true);
    setError('');
    fetchFundraiserData(fundraiserId);
  };
  // Update data if we have helpRequestId
  useEffect(() => {
    const { helpRequestId } = router.query;
    if (helpRequestId && typeof helpRequestId === 'string') {
      setFundraiserId(helpRequestId);
      setError('');
      setIsLoading(true);
      fetchFundraiserData(helpRequestId);
    }
  }, [router.query, contract]);

  // Dummy
  const overrideRpcProvider = () => Promise.resolve();

  // Force Sepolia
  const checkAndSwitchToSepoliaNetwork = () => {
    if (!window.ethereum) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      window.ethereum.request({ method: 'eth_chainId' })
        .then((chainId: string) => {
          if (chainId !== '0xaa36a7') {
            window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa36a7' }],
            })
              .then(() => {
                overrideRpcProvider().then(() => resolve(true)).catch(() => resolve(true));
              })
              .catch((switchError: any) => {
                if (switchError.code === 4902) {
                  window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                      {
                        chainId: '0xaa36a7',
                        chainName: 'Sepolia Test Network',
                        nativeCurrency: {
                          name: 'Sepolia ETH',
                          symbol: 'SEP',
                          decimals: 18
                        },
                        rpcUrls: [
                          'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
                          'https://eth-sepolia.public.blastapi.io',
                          'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
                          'https://rpc.sepolia.org'
                        ],
                        blockExplorerUrls: ['https://sepolia.etherscan.io']
                      }
                    ],
                  })
                    .then(() => resolve(true))
                    .catch((addError: any) => {
                      console.error('Error adding Sepolia network:', addError);
                      resolve(false);
                    });
                } else {
                  console.error('Error switching to Sepolia network:', switchError);
                  resolve(false);
                }
              });
          } else {
            overrideRpcProvider().then(() => resolve(true)).catch(() => resolve(true));
          }
        })
        .catch((error: any) => {
          console.error('Error checking network:', error);
          resolve(false);
        });
    });
  };

  // ================================
  //   USDC ALLOWANCE / APPROVAL
  // ================================
  // Because the contract does ( _amount * 1e6 ), we only allow integer amounts in the UI
  const checkUSDCAllowance = async (integerDonation: number) => {
    if (!window.ethereum) {
      throw new Error("No wallet detected");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    const usdcContract = new Contract(USDC_ADDRESS, usdcABI, provider);
    const contractAddress = contract?.target?.toString() || "";
    const allowanceRaw = await usdcContract.allowance(userAddress, contractAddress);

    // "allowanceRaw" is a BigInt of base units
    // The contract will do integerDonation * 10^6 => so we compare to that
    const neededBaseUnits = BigInt(integerDonation) * BigInt(1_000_000);
    const allowanceFormatted = ethers.formatUnits(allowanceRaw, 6);

    console.log(`USDC Allowance: ${allowanceFormatted} USDC (${allowanceRaw} base units)`);
    console.log(`Needed base units for donation: ${neededBaseUnits}`);

    const hasEnoughAllowance = allowanceRaw >= neededBaseUnits;

    return {
      hasEnoughAllowance,
      allowance: allowanceFormatted,
      allowanceRaw
    };
  };

  // Approve enough base units
  const approveUSDC = async () => {
    try {
      setIsSubmitting(true);
      setDonationError('');

      if (!window.ethereum) {
        throw new Error("No wallet detected");
      }

      const userAmountFloat = parseFloat(donationAmount);
      if (isNaN(userAmountFloat) || userAmountFloat <= 0) {
        throw new Error("Please enter a valid amount (minimum 1 USDC, no decimals).");
      }

      const integerDonation = Math.floor(userAmountFloat);
      if (integerDonation < 1) {
        throw new Error("Please enter at least 1 USDC donation.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdcContract = new Contract(USDC_ADDRESS, usdcABI, signer);
      // e.g. if user typed 5 => we must approve (5 * 1e6) base units
      const baseUnitsToApprove = BigInt(integerDonation) * BigInt(1_000_000);

      const contractAddress = contract?.target?.toString();
      if (!contractAddress) {
        throw new Error("Contract address is missing");
      }

      console.log(`Approving integerDonation = ${integerDonation} => ${baseUnitsToApprove} base units`);

      const tx = await usdcContract.approve(contractAddress, baseUnitsToApprove);
      console.log("Approval transaction submitted:", tx.hash);

      await tx.wait();
      console.log("Approval confirmed!");

      // Check updated allowance
      const { allowance } = await checkUSDCAllowance(integerDonation);
      alert(`Successfully approved ${integerDonation} USDC for donation. Current allowance: ${allowance} USDC`);
      
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error approving USDC:", error);
      setDonationError(`Failed to approve USDC: ${error instanceof Error ? error.message : String(error)}`);
      setIsSubmitting(false);
    }
  };

  // Submit donation
  const handleDonationSubmit = () => {
    setIsSubmitting(true);
    setDonationError('');

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        setDonationError('A Web3 wallet like MetaMask is required');
        setIsSubmitting(false);
        return;
      }
      if (!contract) {
        setDonationError('Contract not initialized');
        setIsSubmitting(false);
        return;
      }
      if (!result || !result.id) {
        setDonationError('No active fundraiser loaded');
        setIsSubmitting(false);
        return;
      }

      const userAmountFloat = parseFloat(donationAmount);
      if (isNaN(userAmountFloat) || userAmountFloat <= 0) {
        setDonationError('Please enter a valid amount (minimum 1 USDC, no decimals).');
        setIsSubmitting(false);
        return;
      }

      const integerDonation = Math.floor(userAmountFloat);
      if (integerDonation < 1) {
        setDonationError('Minimum 1 USDC donation (whole dollars).');
        setIsSubmitting(false);
        return;
      }

      // Check allowance
      checkUSDCAllowance(integerDonation)
        .then(({ hasEnoughAllowance, allowance }) => {
          if (!hasEnoughAllowance) {
            setDonationError(`Insufficient USDC allowance. Approved: ${allowance} USDC. Please click 'Approve USDC' first.`);
            setIsSubmitting(false);
            return;
          }

          const provider = new ethers.BrowserProvider(window.ethereum);
          provider.getNetwork()
            .then(network => {
              if (network.chainId !== BigInt(11155111)) {
                setDonationError('Please switch to Sepolia network in your wallet');
                setIsSubmitting(false);
                return;
              }
              proceedWithDonation(integerDonation);
            })
            .catch(err => {
              console.error("Error checking network:", err);
              setDonationError("Failed to check your network. Please ensure you're on Sepolia");
              setIsSubmitting(false);
            });
        })
        .catch(err => {
          console.error("Error checking USDC allowance:", err);
          setDonationError("Failed to check your USDC allowance");
          setIsSubmitting(false);
        });
    } catch (err: any) {
      console.error('Donation error:', err);
      setDonationError(err.message || 'Failed to process donation. Please try again.');
      setIsSubmitting(false);
    }
  };

  const proceedWithDonation = (integerDonation: number) => {
    const currentFundraiserId = result.id;
    console.log(`Proceeding with donation for fundraiser #${currentFundraiserId}, integer = ${integerDonation}`);

    const provider = new ethers.BrowserProvider(window.ethereum);
    try {
      provider.getSigner()
        .then(signer => {
          const contractWithSigner = new Contract(contract?.target?.toString() || '', contractABI, signer);

          // The contract will do _amount * 1e6, so we pass integerDonation
          console.log(`Calling recordDonation(${currentFundraiserId}, ${integerDonation})...`);
          contractWithSigner.recordDonation(currentFundraiserId, integerDonation)
            .then(tx => {
              console.log("Donation transaction submitted:", tx.hash);
              alert(`Donation transaction submitted! Hash: ${tx.hash}\n\nPlease wait for confirmation...`);

              tx.wait()
                .then(() => {
                  console.log("Donation confirmed");
                  setDonationAmount('');
                  setShowDonationInput(false);
                  setIsSubmitting(false);
                  fetchFundraiserData(currentFundraiserId.toString());
                  alert('Your donation has been successfully processed!');
                })
                .catch((confirmErr: Error) => {
                  console.log("Could not confirm donation status, please check etherscan", confirmErr);
                  setDonationAmount('');
                  setShowDonationInput(false);
                  setIsSubmitting(false);
                  fetchFundraiserData(currentFundraiserId.toString());
                });
            })
            .catch(err => {
              console.error("Error processing donation:", err);
              if (err.message && err.message.includes("user rejected")) {
                setDonationError("Transaction was rejected by your wallet");
              } else {
                setDonationError(`Transaction failed: ${err.message}`);
              }
              setIsSubmitting(false);
            });
        })
        .catch(err => {
          console.error("Error getting signer:", err);
          setDonationError(`Failed to access wallet: ${err.message}`);
          setIsSubmitting(false);
        });
    } catch (err: any) {
      console.error("Error processing donation:", err);
      setDonationError(`Failed to process donation: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  // Navigate to a new fundraiser
  const navigateToFundraiser = (id: string) => {
    if (id === fundraiserId && result && result.id === id) {
      return;
    }
    setResult(null);
    setError('');
    setIsLoading(true);
    setFundraiserId(id);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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

  // We interpret goal & raised as final USDC values from the contract
  // Just format them to e.g. "$4.00"
  const formatWholeUSDC = (val: number) => {
    return `$${val.toFixed(2)}`;
  };

  // For debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log(`Current URL: ${window.location.href}`);
    }
  }, []);


  // ============================
  //  Render
  // ============================
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
        {error && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'error.main', color: 'white' }}>
            <Typography variant="h6">Error</Typography>
            <Typography>{error}</Typography>
            <Box sx={{ mt: 2 }}>
              <Button 
                onClick={() => {
                  setResult(null);
                  setError('');
                  const baseUrl = window.location.origin;
                  window.location.href = `${baseUrl}/helprequest?helpRequestId=0`;
                }}
                className="bg-primary"
              >
                Go to Fundraiser #0
              </Button>
            </Box>
          </Paper>
        )}

        {!router.query.helpRequestId && (
          <Paper sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Enter Fundraiser ID
            </Typography>
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

        {result && (
          <>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                onClick={() => {
                  if (result && result.id >= 1) {
                    const prevId = parseInt(result.id) - 1;
                    navigateToFundraiser(prevId.toString());
                  }
                }}
                disabled={result.id === 0 || isLoading}
                className="bg-primary"
              >
                &larr; Previous
              </Button>

              <Typography variant="body1" sx={{ py: 1, px: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                ID: {result.id}
              </Typography>

              <Button
                onClick={() => {
                  if (result && result.id >= 0) {
                    const nextId = parseInt(result.id) + 1;
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
              <Grid item xs={12} md={8}>
                <Typography variant="h4" gutterBottom>
                  {result.subject}
                </Typography>

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
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                      {result.details}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper
                  elevation={2}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                  }}
                >
                  {/* formatWholeUSDC => show e.g. $5.00 */}
                  <Typography variant="h4" gutterBottom>
                    {formatWholeUSDC(result.amountRaised)}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      collected of {formatWholeUSDC(result.goal)}
                    </Typography>

                    <Box sx={{ width: '100%', mb: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(() => {
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
                          },
                        }}
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {(() => {
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
                            label="Whole USDC to donate (no decimals)"
                            type="number"
                            value={donationAmount}
                            onChange={handleInputChange(setDonationAmount)}
                            inputProps={{ min: "1", step: "1" }}
                            sx={{ mb: 1 }}
                            error={!!donationError}
                            helperText={donationError || ""}
                          />

                          <Alert severity="warning" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              <strong>Note:</strong> The contract multiplies your integer by 1e6.
                              Any decimals you type will be truncated.
                            </Typography>
                          </Alert>

                          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <Button
                              className="w-full py-6 text-lg font-semibold"
                              size="lg"
                              onClick={approveUSDC}
                              disabled={isSubmitting || !window.ethereum || !donationAmount}
                            >
                              {isSubmitting ? 'Processing...' : 'Approve USDC'}
                            </Button>

                            <Button
                              className="w-full py-6 text-lg font-semibold"
                              size="lg"
                              onClick={handleDonationSubmit}
                              disabled={isSubmitting || !window.ethereum || !donationAmount}
                            >
                              {isSubmitting ? 'Processing...' : 'Donate'}
                            </Button>
                          </Box>
                        </>
                      )}

                      {!showDonationInput && (
                        <Button
                          className="w-full mt-2 py-6 text-lg font-semibold"
                          size="lg"
                          onClick={() => setShowDonationInput(true)}
                          disabled={isSubmitting || !window.ethereum}
                        >
                          Help
                        </Button>
                      )}

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

        {router.query.helpRequestId && !result && !error && isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8, flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Loading fundraiser data...
            </Typography>
            <LinearProgress sx={{ width: '50%', mt: 2 }} />
          </Box>
        )}

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
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', mb: 2 }}>
              <Box sx={{ mr: 2, mb: { xs: 2, sm: 0 }, textAlign: { xs: 'center', sm: 'left' } }}>
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
                onClick={() => window.location.reload()}
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
