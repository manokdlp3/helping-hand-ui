import { useRouter } from 'next/router';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useVerification } from '@/contexts/VerificationContext';
import { useContract, Fundraiser } from '@/hooks/useContract';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Type for UI display data
interface HelpRequest {
  id: number;
  title: string;
  location: string;
  description: string;
  amountRaised: string;
  imageUrl: string;
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

// Function to get a random location
const getLocation = (id: number) => {
  const locations = [
    "Denver, CO",
    "Boulder, CO",
    "Fort Collins, CO",
    "Colorado Springs, CO",
    "Aspen, CO",
  ];
  return locations[id % locations.length];
};

export default function LendAHand() {
  const router = useRouter();
  const { isVerified } = useVerification();
  const { contract, contractError, isLoading, getAllFundraisers, getFundraiser } = useContract();
  
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Load data from contract
  useEffect(() => {
    const fetchFundraisers = async () => {
      setLoadingData(true);
      
      // Define mock data we'll always show for testing purposes
      const mockHelpRequests = [
        {
          id: 0,
          title: "Test Fundraiser",
          location: "Denver, CO",
          description: "This is a test fundraiser created to demonstrate the functionality of the Helping Hand platform.",
          amountRaised: "$5.00 USD",
          imageUrl: "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&q=80"
        },
        {
          id: 1,
          title: "Senior Needs Grocery Shopping Assistance",
          location: "Boulder, CO",
          description: "Elderly person needs weekly help with grocery shopping",
          amountRaised: "$2103.00 USD",
          imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80"
        },
        {
          id: 2,
          title: "Garden Maintenance Help",
          location: "Fort Collins, CO",
          description: "Need help maintaining community garden for local food bank",
          amountRaised: "$400.00 USD",
          imageUrl: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&q=80"
        }
      ];
      
      try {
        setFetchError(null);
        let requests: HelpRequest[] = [];
        
        // Try to get contract data only if available
        if (contract) {
          try {
            // First try to get all fundraisers
            const fundraisers = await getAllFundraisers(0, 10);
            
            if (fundraisers && fundraisers.length > 0) {
              // Transform data for display
              const contractRequests = fundraisers.map((f, index) => ({
                id: index,
                title: f.subject || `Fundraiser #${index}`,
                location: getLocation(index),
                description: f.additionalDetails || 'No description provided',
                amountRaised: `$${parseFloat(f.amountRaised || '0').toFixed(2)} USD`,
                imageUrl: getRandomImage(index)
              }));
              
              // Add contract requests to our collection
              requests = [...contractRequests];
            }
          } catch (contractDataError) {
            console.warn('Error fetching data from contract:', contractDataError);
            // If error fetching data, continue with mock data
          }
        }
        
        // Either combine real results with mock data or just use mock data
        if (requests.length > 0) {
          // If we have some real requests, make sure we have at least 3 total
          const existingIds = new Set(requests.map(r => r.id));
          
          // Add any mock requests that don't conflict with real IDs
          for (const mockRequest of mockHelpRequests) {
            if (!existingIds.has(mockRequest.id) && requests.length < 3) {
              requests.push(mockRequest);
              existingIds.add(mockRequest.id);
            }
          }
          
          setHelpRequests(requests);
        } else {
          // If no real requests, use all mock data
          setHelpRequests(mockHelpRequests);
        }
      } catch (error: any) {
        console.error('Error in fundraiser fetching:', error);
        setFetchError('Error loading fundraisers. Showing demo data instead.');
        // Always default to mock data on error
        setHelpRequests(mockHelpRequests);
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchFundraisers();
  }, [contract, getAllFundraisers, getFundraiser, contractError]);

  const handleCardClick = (id: number) => {
    router.push(`/helprequest?helpRequestId=${id}`);
  };

  const handleAskForHelp = () => {
    if (!isVerified) {
      router.push('/verify');
      return;
    }
    router.push('/createhelprequest');
  };

  // Skeleton component for loading
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
        
        {isLoading && (
          <div className="text-center py-8">
            <p className="text-lg mb-4">Connecting to the blockchain...</p>
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        )}
        
        {contractError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {contractError}
            </AlertDescription>
          </Alert>
        )}
        
        {fetchError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading fundraisers</AlertTitle>
            <AlertDescription>
              {fetchError}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingData ? (
            // Show skeletons during loading
            Array(6).fill(0).map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} />
            ))
          ) : (
            // Show data when loaded
            helpRequests.map((request) => (
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
                  <p className="text-gray-600 mb-4">{request.description}</p>
                  
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
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
