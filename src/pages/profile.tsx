import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Typography, Container, Paper, Box, Tabs, Tab, Grid, LinearProgress } from '@mui/material';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { useVerification } from '@/contexts/VerificationContext';
import { useContract, Fundraiser } from '@/hooks/useContract';
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Interface for donation
interface Donation {
  id: number;
  fundraiserId: number;
  amount: string;
  date: string;
  title: string;
}

// Function to get a random image
const getRandomImage = (id: number) => {
  const images = [
    "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1596079890744-c1a0462d0975?auto=format&fit=crop&q=80",
  ];
  return images[id % images.length];
};

export default function ProfilePage() {
  const router = useRouter();
  const { isVerified } = useVerification();
  const { contract, contractError, isLoading } = useContract();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<number>(0);
  
  // Data states
  const [myRequests, setMyRequests] = useState<Fundraiser[]>([]);
  const [myDonations, setMyDonations] = useState<Donation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('0x123...abc');
  
  // Tab change handler
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // If user is not verified, redirect to verification page
  useEffect(() => {
    if (!isVerified && typeof window !== 'undefined') {
      router.push('/verify?returnUrl=/profile');
    }
  }, [isVerified, router]);
  
  // Get wallet address
  useEffect(() => {
    const getWalletAddress = async () => {
      if (!isVerified) {
        return; // Only try if user is verified
      }
      
      try {
        // Safely check for ethereum provider
        if (typeof window !== 'undefined' && window.ethereum) {
          try {
            // Use safer method to get accounts
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              setWalletAddress(accounts[0]);
            } else {
              console.log('No accounts found or user not connected');
              setWalletAddress('No wallet connected');
            }
          } catch (ethError) {
            console.error('Error getting wallet address:', ethError);
            setWalletAddress('Error retrieving address');
          }
        } else {
          console.log('No ethereum provider available');
          setWalletAddress('No wallet detected');
        }
      } catch (error) {
        console.error('Unexpected error accessing wallet:', error);
        setWalletAddress('Wallet access error');
      }
    };
    
    getWalletAddress();
  }, [isVerified]);
  
  // Load user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!contract || !isVerified) return;
      
      try {
        setIsLoadingData(true);
        setError(null);
        
        // Future implementation: logic to load user data from smart contract
        // For now, using mock data
        
        // Simulating loading delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data for user's help requests
        setMyRequests([
          {
            owner: "0x123...abc",
            startDate: new Date().toLocaleString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleString(),
            subject: "Help with Apartment Repair",
            additionalDetails: "Need help with repairs after flooding from neighbors",
            fundraiserGoal: "5000000",
            amountRaised: "2000000",
            isCompleted: false,
            goalReached: false
          },
          {
            owner: "0x123...abc",
            startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toLocaleString(),
            endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleString(),
            subject: "Medical Treatment Fundraiser",
            additionalDetails: "Need help paying for surgery",
            fundraiserGoal: "10000000",
            amountRaised: "10000000",
            isCompleted: true,
            goalReached: true
          }
        ]);
        
        // Mock data for user's donations
        setMyDonations([
          {
            id: 1,
            fundraiserId: 5,
            amount: "100",
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleString(),
            title: "Help for Elderly"
          },
          {
            id: 2,
            fundraiserId: 8,
            amount: "50",
            date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toLocaleString(),
            title: "School Supplies Fundraiser"
          },
          {
            id: 3,
            fundraiserId: 12,
            amount: "200",
            date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toLocaleString(),
            title: "Charity Run"
          }
        ]);
        
      } catch (err: any) {
        console.error('Error loading user data:', err);
        setError(err.message || 'Failed to load user data');
      } finally {
        setIsLoadingData(false);
      }
    };
    
    fetchUserData();
  }, [contract, isVerified]);
  
  // Skeleton component for loading state
  const SkeletonCard = () => (
    <div className="overflow-hidden rounded-lg shadow">
      <Skeleton className="h-[200px] w-full" />
      <div className="p-4">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <div className="flex items-center justify-between mt-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-1/3" />
        </div>
      </div>
    </div>
  );
  
  // Handler for navigating to create request page
  const handleCreateRequest = () => {
    router.push('/createhelprequest');
  };
  
  // Handler for navigating to request details page
  const handleViewRequest = (id: number) => {
    router.push(`/helprequest?helpRequestId=${id}`);
  };
  
  // If user is not verified, don't show the page
  if (!isVerified) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>My Profile - Helping Hand</title>
        <meta
          content="View your profile, help requests and donations on the Helping Hand platform"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <Navigation isVerified={isVerified} onAskForHelp={() => router.push('/createhelprequest')} />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" className="font-bold mb-8 bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent">
          My Profile
        </Typography>
        
        {/* Profile information */}
        <Paper sx={{ p: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Welcome!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Wallet ID: {walletAddress}
              </Typography>
            </Box>
            
            <Button
              className="mt-4 md:mt-0"
              onClick={handleCreateRequest}
            >
              Create New Help Request
            </Button>
          </Box>
        </Paper>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="profile tabs">
            <Tab label="My Help Requests" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="My Donations" id="tab-1" aria-controls="tabpanel-1" />
          </Tabs>
        </Box>
        
        {/* Tab content */}
        <div
          role="tabpanel"
          hidden={activeTab !== 0}
          id="tabpanel-0"
          aria-labelledby="tab-0"
        >
          {activeTab === 0 && (
            <>
              {isLoadingData ? (
                <Grid container spacing={3}>
                  {Array(3).fill(0).map((_, index) => (
                    <Grid item xs={12} md={6} key={`skeleton-${index}`}>
                      <SkeletonCard />
                    </Grid>
                  ))}
                </Grid>
              ) : myRequests.length > 0 ? (
                <Grid container spacing={3}>
                  {myRequests.map((request, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Card 
                        className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-300"
                        onClick={() => handleViewRequest(index)}
                      >
                        <div className="aspect-video relative">
                          <img 
                            src={getRandomImage(index)} 
                            alt={request.subject}
                            className="object-cover w-full h-full"
                          />
                          {request.isCompleted && (
                            <div className="absolute top-0 right-0 p-2 bg-green-500 text-white">
                              {request.goalReached ? 'Goal Reached' : 'Completed'}
                            </div>
                          )}
                        </div>
                        
                        <div className="p-4">
                          <h2 className="text-xl font-semibold mb-2">{request.subject}</h2>
                          <p className="text-gray-600 mb-4 line-clamp-2">{request.additionalDetails}</p>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-green-600 font-semibold">${parseInt(request.amountRaised) / 1000000} USD</span>
                            <div className="text-sm text-gray-500">of ${parseInt(request.fundraiserGoal) / 1000000} USD</div>
                          </div>
                          
                          <Box sx={{ width: '100%', mt: 1, mb: 2 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={Math.min((parseInt(request.amountRaised) / parseInt(request.fundraiserGoal)) * 100, 100)}
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
                          
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 text-sm">Created: {request.startDate}</span>
                            <Button 
                              variant="outline"
                              className="hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewRequest(index);
                              }}
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>You don't have any help requests yet</Typography>
                  <Typography variant="body1" paragraph>
                    Create your first request and get help from the community
                  </Typography>
                  <Button 
                    onClick={handleCreateRequest}
                    className="mt-2"
                  >
                    Create Request
                  </Button>
                </Paper>
              )}
            </>
          )}
        </div>
        
        <div
          role="tabpanel"
          hidden={activeTab !== 1}
          id="tabpanel-1"
          aria-labelledby="tab-1"
        >
          {activeTab === 1 && (
            <>
              {isLoadingData ? (
                <Grid container spacing={3}>
                  {Array(3).fill(0).map((_, index) => (
                    <Grid item xs={12} key={`skeleton-${index}`}>
                      <Skeleton className="h-24 w-full rounded-lg" />
                    </Grid>
                  ))}
                </Grid>
              ) : myDonations.length > 0 ? (
                <Grid container spacing={2}>
                  {myDonations.map((donation, index) => (
                    <Grid item xs={12} key={index}>
                      <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6">{donation.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              Donated: {donation.date}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="h6" color="success.main">
                              ${parseInt(donation.amount)} USD
                            </Typography>
                            <Button 
                              variant="outline"
                              size="sm"
                              className="text-sm"
                              onClick={() => handleViewRequest(donation.fundraiserId)}
                            >
                              View
                            </Button>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>You don't have any donations yet</Typography>
                  <Typography variant="body1" paragraph>
                    Help other users achieve their goals
                  </Typography>
                  <Button 
                    onClick={() => router.push('/lendahand')}
                    className="mt-2"
                  >
                    Browse Help Requests
                  </Button>
                </Paper>
              )}
            </>
          )}
        </div>
      </Container>

      <Footer />
    </div>
  );
} 