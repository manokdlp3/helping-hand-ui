import Head from 'next/head';
import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { useRouter } from 'next/router';
import contractABI from '../contractABI.json';

const CONTRACT_ADDRESS = '0x308A7629a5C39f9073D4617A4e95A205d4474E07';
const MAX_FUNDRAISERS = 50;

const FUNDRAISER_IMAGES = [
  '/image 1.svg', // For fundraiser with ID 6
  '/image 4.svg', // For fundraiser with ID 7
  '/image 5.svg', // For fundraiser with ID 8
  '/image 6.svg',
  '/image 2.svg',
  '/image 10.svg',
  '/image 8.svg',
  '/image 3.svg',
  '/image 9.svg'
];

type FilterType = 'all' | 'active' | 'completed';

function formatGoal(amount: number) {
  return Math.round(amount).toLocaleString();
}

function formatRaised(amount: number) {
  if (Number.isInteger(amount)) {
    return amount.toLocaleString();
  } else {
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

export default function Browse() {
  const router = useRouter();
  
  const [fundraisers, setFundraisers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchAllFundraisers();
    }
  }, []);

  async function fetchAllFundraisers() {
    try {
      if (!window.ethereum) {
        console.error('MetaMask is not installed.');
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, provider);

      const fetched: any[] = [];
      for (let i = 0; i < MAX_FUNDRAISERS; i++) {
        // Skip fundraiser IDs less than 7 or ID equal to 16
        if (i < 7 || i === 16) continue;

        try {
          const data = await contract.getFundraiser(i);
          const ownerAddr = data[0];
          if (ownerAddr === '0x0000000000000000000000000000000000000000') continue;

          const subject = data[3];
          const details = data[4];
          const goal = Number(data[5]) / 1e6;
          const raised = Number(data[6]) / 1e6;

          fetched.push({
            id: i,
            owner: ownerAddr,
            title: subject || `Fundraiser #${i}`,
            description: details || 'No description provided',
            goal,
            raised
          });
        } catch (err) {
          console.log(`Skipping ID ${i} due to error:`, err);
        }
      }
      setFundraisers(fetched);
    } catch (err) {
      console.error('Error fetching fundraisers:', err);
    }
  }

  const searchedFundraisers = fundraisers.filter((f) => {
    const combined = (f.title + f.description).toLowerCase();
    return combined.includes(searchTerm.toLowerCase());
  });

  let finalFundraisers = searchedFundraisers;
  if (filterType === 'active') {
    finalFundraisers = finalFundraisers.filter((f) => f.raised < f.goal);
  } else if (filterType === 'completed') {
    finalFundraisers = finalFundraisers.filter((f) => f.raised >= f.goal);
  }

  function handleViewFundraiser(id: number) {
    router.push(`/lend?fundraiserId=${id}`);
  }

  return (
    <>
      <Head>
        <title>Browse Fundraisers</title>
        <meta name="description" content="Browse all available fundraisers" />
      </Head>

      <Navbar />

      <main className="bg-black text-white w-full min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8 w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Browse Fundraisers</h1>
            <div className="flex flex-col md:flex-row justify-center items-center gap-4">
              <input
                type="text"
                placeholder="Search fundraisers by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-1/2 px-4 py-2 rounded bg-gray-100 text-black placeholder-gray-500 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400"
              />

              <div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="px-4 py-2 rounded bg-gray-100 text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {finalFundraisers.length === 0 ? (
            <p className="text-center">No fundraisers found.</p>
          ) : (
            <div className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {finalFundraisers.map((fund) => {
                const progressRaw = fund.goal > 0 ? (fund.raised / fund.goal) * 100 : 0;
                const progress = Math.min(progressRaw, 100);
                const imageIndex = fund.id - 7;
                const imageUrl = FUNDRAISER_IMAGES[imageIndex] || '/images/placeholder.jpg';

                const truncatedDesc = fund.description.length > 200
                  ? fund.description.slice(0, 200) + '...'
                  : fund.description;

                return (
                  <div
                    key={fund.id}
                    className="bg-[rgba(63,63,63,0.5)] rounded-lg p-4 flex flex-col h-[450px]"
                  >
                    <div className="mb-4 h-48 overflow-hidden rounded">
                      <img
                        src={imageUrl}
                        alt={`Fundraiser ${fund.id}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <h2 className="text-xl font-bold mb-2">{fund.title}</h2>
                    <p className="text-sm text-gray-300 mb-4 flex-1">
                      {truncatedDesc}
                    </p>

                    <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
                      <div
                        className="bg-green-500 h-4 rounded-full"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm mb-4">
                      ${formatRaised(fund.raised)} raised of ${formatGoal(fund.goal)} goal
                    </p>

                    <button
                      onClick={() => handleViewFundraiser(fund.id)}
                      className="bg-green-500 hover:bg-green-600 text-white py-2 rounded-md font-semibold mt-auto"
                    >
                      View Fundraiser
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
