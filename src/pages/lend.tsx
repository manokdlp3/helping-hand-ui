import Head from 'next/head';
import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import contractABI from '../contractABI.json';

// ===== ADDED: Minimal USDC ABI for allowance/approve checks =====
const USDC_ABI = [
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const CONTRACT_ADDRESS = '0x308A7629a5C39f9073D4617A4e95A205d4474E07';
const USDC_ADDRESS = '0xf08A50178dfcDe18524640EA6618a1f965821715';

// The same array of images, no changes to your design
const FUNDRAISER_IMAGES = [
  '/image 1.svg', // For fundraiser with ID 7
  '/image 4.svg', // For fundraiser with ID 8
  '/image 5.svg', // For fundraiser with ID 9
  '/image 6.svg', // For fundraiser with ID 10
  '/image 2.svg', // For fundraiser with ID 11
  '/image 10.svg',// For fundraiser with ID 12
  '/image 8.svg', // For fundraiser with ID 13
  '/image 3.svg', // For fundraiser with ID 14
  '/image 9.svg'  // For fundraiser with ID 15 (and so on...)
];

export default function Lend() {
  const router = useRouter();
  const { fundraiserId } = router.query;
  const [fundraiserIds, setFundraiserIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountCollected, setAmountCollected] = useState<number>(0);
  const [amountNeeded, setAmountNeeded] = useState<number>(0);

  // This donationAmount is typed by the user, and the design remains the same
  const [donationAmount, setDonationAmount] = useState('10');

  const [showFullDesc, setShowFullDesc] = useState(false);

  // ======== Original init code (unchanged) ========
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initFundraisers();
    }
  }, []);

  useEffect(() => {
    if (fundraiserIds.length > 0 && fundraiserId) {
      const queryId = Number(fundraiserId);
      const idx = fundraiserIds.findIndex((id) => id === queryId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      } else {
        setCurrentIndex(0);
      }
    }
  }, [fundraiserIds, fundraiserId]);

  useEffect(() => {
    if (fundraiserIds.length > 0) {
      fetchFundraiserData(fundraiserIds[currentIndex]);
    }
  }, [currentIndex, fundraiserIds]);

  async function initFundraisers() {
    try {
      if (!window.ethereum) {
        console.error('MetaMask is not installed.');
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, provider);
      const data = await contract.batchGetFundraisers(0, 100);
      console.log('Batch response:', data);

      const validIds: number[] = [];
      for (let i = 0; i < data.owners.length; i++) {
        // Skip IDs < 7 and skip ID === 16
        if (i < 7 || i === 16) continue;
        const ownerAddr = data.owners[i];
        if (ownerAddr !== '0x0000000000000000000000000000000000000000') {
          validIds.push(i);
        }
      }
      if (validIds.length === 0) {
        console.warn('No valid fundraisers found!');
      }
      setFundraiserIds(validIds);
      if (!fundraiserId) {
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error('Error fetching fundraiser list:', err);
    }
  }

  async function fetchFundraiserData(fundraiserId: number) {
    try {
      if (!window.ethereum) {
        console.error('MetaMask is not installed.');
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, provider);
      const info = await contract.getFundraiser(fundraiserId);
      console.log(`Fundraiser #${fundraiserId} data:`, info);

      const [ , , , subject, details, fundraiserGoal, amountsRaised ] = info;
      const realGoal = Number(fundraiserGoal) / 1e6;
      const realRaised = Number(amountsRaised) / 1e6;

      setTitle(subject);
      setDescription(details);
      setAmountNeeded(realGoal);
      setAmountCollected(realRaised);
      setShowFullDesc(false);
    } catch (error) {
      console.error('Error fetching fundraiser data:', error);
    }
  }

  function handleNext() {
    if (fundraiserIds.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % fundraiserIds.length);
  }

  function handlePrev() {
    if (fundraiserIds.length === 0) return;
    setCurrentIndex((prev) => (prev === 0 ? fundraiserIds.length - 1 : prev - 1));
  }

  const rawProgress = amountNeeded > 0 ? (amountCollected / amountNeeded) * 100 : 0;
  const progress = Math.min(rawProgress, 100);

  // =============== NEW HELPER: check allowance ===============
  async function checkUSDCAllowance(signerAddress: string, signer: any, neededBaseUnits: bigint) {
    const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, signer);
    const allowanceRaw = await usdcContract.allowance(signerAddress, CONTRACT_ADDRESS);

    console.log("Current USDC allowance (raw):", allowanceRaw.toString());
    return allowanceRaw >= neededBaseUnits;
  }

  // =============== NEW HELPER: do an approval ===============
  async function approveUSDC(signer: any, neededBaseUnits: bigint) {
    const usdcContract = new Contract(USDC_ADDRESS, USDC_ABI, signer);
    console.log("Approving USDC for baseUnits:", neededBaseUnits.toString());

    const txApprove = await usdcContract.approve(CONTRACT_ADDRESS, neededBaseUnits);
    await txApprove.wait();
    console.log("USDC approval confirmed!");
  }

  // =============== REPLACED handleDonateUSDC with working logic ===============
  async function handleDonateUSDC() {
    if (!window.ethereum) {
      alert('Please install MetaMask to donate.');
      return;
    }

    try {
      // parse the user’s donation
      const userAmountFloat = parseFloat(donationAmount);
      if (isNaN(userAmountFloat) || userAmountFloat <= 0) {
        alert('Please enter a valid donation amount in USDC.');
        return;
      }

      // Convert to base units
      const baseUnits = parseUnits(donationAmount, 6);
      console.log(`User typed: ${donationAmount} => baseUnits = ${baseUnits.toString()}`);

      // 1) Connect to user’s wallet
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      // 2) Check allowance
      const hasEnoughAllowance = await checkUSDCAllowance(signerAddress, signer, baseUnits);
      if (!hasEnoughAllowance) {
        // 2a) If insufficient allowance, do an approval
        alert(`Not enough USDC allowance. Approving now for ${donationAmount} USDC...`);
        await approveUSDC(signer, baseUnits);
      }

      // 3) Donation call
      const mainContract = new Contract(CONTRACT_ADDRESS, contractABI, signer);
      const currentFundId = fundraiserIds[currentIndex];

      alert(`Donating ${donationAmount} USDC to fundraiser #${currentFundId}...`);
      const txDonate = await mainContract.recordDonation(currentFundId, baseUnits);
      await txDonate.wait();
      console.log(`Donated ${donationAmount} USDC successfully!`);
      alert(`Donation of ${donationAmount} USDC confirmed!`);

      // 4) Refresh data
      fetchFundraiserData(currentFundId);
    } catch (error: any) {
      console.error('Error donating USDC:', error);
      alert(`Donation failed: ${error.message || error}`);
    }
  }

  // Map image: subtract 7 so that fundraiser with ID 7 uses the first image in FUNDRAISER_IMAGES
  let imageUrl = '/images/placeholder.jpg';
  if (fundraiserIds.length > 0) {
    const currentId = fundraiserIds[currentIndex];
    imageUrl = FUNDRAISER_IMAGES[currentId - 7] || '/images/placeholder.jpg';
  }

  const MAX_CHARS = 300;
  const truncatedDesc = description.slice(0, MAX_CHARS);

  return (
    <>
      <Head>
        <title>Lend a Hand</title>
        <meta name="description" content="Help someone in need by donating in USDC" />
      </Head>

      <Navbar />

      <main className="bg-black text-white min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Keep your design: only two arrow buttons, no text */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={handlePrev}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-md"
            >
              ← Prev
            </button>
            <button
              onClick={handleNext}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-md"
            >
              Next →
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-2/3 flex-shrink-0">
              <img
                src={imageUrl}
                alt="Campaign Banner"
                className="w-full h-auto md:max-h-96 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/placeholder.jpg';
                }}
              />
            </div>

            <div className="md:w-1/3 bg-[rgba(63,63,63,0.5)] rounded-lg p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  {title || 'Fundraiser Title'}
                </h2>
                <div className="mb-4 text-sm md:text-base whitespace-pre-wrap">
                  {description.length <= MAX_CHARS
                    ? description
                    : showFullDesc
                      ? description
                      : truncatedDesc + '...'}
                  {description.length > MAX_CHARS && (
                    <button
                      onClick={() => setShowFullDesc(!showFullDesc)}
                      className="text-blue-400 underline ml-2"
                    >
                      {showFullDesc ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
                <p className="mb-4 text-lg md:text-xl font-bold">
                  <span className="text-green-400">
                    ${amountCollected.toLocaleString()}
                  </span>{' '}
                  collected of ${amountNeeded.toLocaleString()} needed
                </p>
                <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
                  <div
                    className="bg-green-500 h-4 rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <label className="block mb-2 font-semibold">
                  Donation Amount (USDC):
                </label>
                <input
                  type="number"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full mb-4 px-3 py-2 rounded bg-gray-100 text-black placeholder-gray-500 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400"
                />

                {/* Donate button uses the new logic */}
                <button
                  onClick={handleDonateUSDC}
                  className="bg-green-500 hover:bg-green-600 text-white w-full py-2 rounded-md font-semibold"
                >
                  Donate USDC
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
