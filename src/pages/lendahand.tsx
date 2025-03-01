import { useRouter } from 'next/router';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { ethers, Contract } from 'ethers';
import contractABI from './abi.json';
import { Alert, CircularProgress, Box } from '@mui/material';
import { useVerification } from '@/contexts/VerificationContext';

export default function LendAHand() {
  const router = useRouter();
  const { isVerified } = useVerification();
  
  const [contract, setContract] = useState<Contract | null>(null);
  const [fundraisers, setFundraisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Initialize contract
  useEffect(() => {
    const initializeContract = async () => {
      try {
        const contractAddress = "0x308A7629a5C39f9073D4617A4e95A205d4474E07";
        
        // Проверяем наличие ethereum без попыток его изменить
        if (typeof window !== 'undefined') {
          if (window.ethereum) {
            console.log("Found Web3 provider - using BrowserProvider");
            try {
              const provider = new ethers.BrowserProvider(window.ethereum);
              const signer = await provider.getSigner();
              const contractInstance = new Contract(contractAddress, contractABI, signer);
              
              // Проверяем наличие интерфейса контракта
              if (contractInstance.interface) {
                const functionNames: string[] = [];
                for (const fragment of contractInstance.interface.fragments) {
                  if (fragment.type === 'function') {
                    // @ts-ignore
                    functionNames.push(fragment.name);
                  }
                }
                console.log("Available contract functions:", functionNames);
                
                // Проверяем, есть ли функция batchGetFundraisers
                if (!functionNames.includes('batchGetFundraisers')) {
                  console.warn("batchGetFundraisers function not found in contract!");
                }
              }
              
              setContract(contractInstance);
            } catch (signerErr) {
              console.error("Error getting signer:", signerErr);
              
              // Если не удалось получить подписчика, используем read-only режим
              const readProvider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
              const contractInstance = new Contract(contractAddress, contractABI, readProvider);
              console.log("Contract initialized in read-only mode");
              setContract(contractInstance);
            }
          } else {
            // Используем read-only провайдер, если ethereum недоступен
            console.log("No Web3 provider found - using read-only provider");
            const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
            const contractInstance = new Contract(contractAddress, contractABI, provider);
            setContract(contractInstance);
          }
        }
      } catch (err) {
        console.error('Error initializing contract:', err);
        setError('Failed to initialize contract. Please check your connection.');
        setLoading(false);
      }
    };

    initializeContract();
  }, []);

  // Fetch fundraisers when contract is ready
  useEffect(() => {
    if (contract) {
      fetchFundraisers();
    }
  }, [contract]);

  // Function to fetch fundraisers using batchGetFundraisers
  const fetchFundraisers = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (!contract) {
        setError('Contract not initialized');
        setLoading(false);
        return;
      }
      
      console.log("Fetching fundraisers using batchGetFundraisers...");
      
      try {
        // Получаем данные с ID от 0 до 100
        const data = await contract.batchGetFundraisers(0, 100);
        console.log("Batch response:", data);
        
        // Проверяем, есть ли данные
        if (!data || !data.owners || !Array.isArray(data.owners) || data.owners.length === 0) {
          console.log("No fundraisers found or empty response");
          setFundraisers([]);
          setLoading(false);
          return;
        }
        
        // Преобразуем данные в удобный формат
        const processedFundraisers = [];
        
        for (let i = 0; i < data.owners.length; i++) {
          // Пропускаем пустые или невалидные записи
          if (!data.owners[i] || data.owners[i] === ethers.ZeroAddress) {
            continue;
          }
          
          try {
            // Вместо использования contentRegistry, мы получим полную информацию через getFundraiser
            const fundraiserDetails = await contract.getFundraiser(i);
            console.log(`Detailed fundraiser #${i}:`, fundraiserDetails);
            
            // Получаем заголовок и описание из ответа getFundraiser
            const title = fundraiserDetails[3] || `Fundraiser #${i}`;
            const description = fundraiserDetails[4] || '';
            
            // Выбираем случайное изображение для визуального представления
            const imageId = Math.floor(Math.random() * 1000);
            
            // Форматируем значения
            const amountNeeded = parseFloat(ethers.formatUnits(fundraiserDetails[5], 6));
            const amountCollected = parseFloat(ethers.formatUnits(fundraiserDetails[6], 6));
            
            // Формируем объект с данными сбора средств
            processedFundraisers.push({
              id: i,
              title: title || `Fundraiser #${i}`,
              location: 'Blockchain', // Можно добавить получение локации, если она доступна
              description: description || `Goal: $${formatUSDC(amountNeeded)}`,
              amountRaised: `$${formatUSDC(amountCollected)} USD`,
              imageUrl: `https://source.unsplash.com/random/800x600?sig=${imageId}`,
              percentComplete: amountNeeded > 0 ? Math.min(100, (amountCollected / amountNeeded) * 100) : 0
            });
          } catch (processingErr) {
            console.error(`Error processing fundraiser ${i}:`, processingErr);
          }
        }
        
        console.log(`Processed ${processedFundraisers.length} valid fundraisers`);
        setFundraisers(processedFundraisers);
        
      } catch (contractErr) {
        console.error("Error calling batchGetFundraisers:", contractErr);
        
        // Если не удалось получить данные через batchGetFundraisers, используем mock данные
        console.log("Falling back to mock data");
        setFundraisers(getMockFundraisers());
      }
      
    } catch (err) {
      console.error('Error fetching fundraisers:', err);
      setError('Failed to load fundraisers');
      
      // В случае ошибки используем mock данные
      setFundraisers(getMockFundraisers());
    } finally {
      setLoading(false);
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

  // Helper function to get mock fundraisers
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
        
        {/* Показываем индикатор загрузки */}
        {loading && (
          <div className="flex justify-center py-16">
            <CircularProgress color="success" />
          </div>
        )}
        
        {/* Показываем сообщение об ошибке */}
        {error && !loading && (
          <Alert severity="error" className="my-4">{error}</Alert>
        )}
        
        {/* Показываем сообщение, если нет сборов средств */}
        {!loading && !error && fundraisers.length === 0 && (
          <Alert severity="info" className="my-4">
            There are currently no active fundraising campaigns. Be the first to create one!
          </Alert>
        )}
        
        {/* Показываем карточки сборов средств */}
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
