import { useRouter } from 'next/router';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Head from 'next/head';
import { useState } from 'react';

// Mock data for help requests
const mockHelpRequests = [
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

export default function LendAHand() {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockHelpRequests.map((request) => (
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
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
