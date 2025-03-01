import Head from 'next/head';
import Navbar from '../components/Navbar';
import { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import contractABI from '../contractABI.json';

const CONTRACT_ADDRESS = '0x308A7629a5C39f9073D4617A4e95A205d4474E07';

export default function Fundraise() {
  // Form fields
  const [fundraiserName, setFundraiserName] = useState('');
  const [fundraiserGoal, setFundraiserGoal] = useState('');
  const [fundraiserStory, setFundraiserStory] = useState('');
  const [fundraiserImage, setFundraiserImage] = useState('');

  // For status/error messages
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Handler to create fundraiser
  async function handleCreateFundraiser() {
    setStatus('');
    setError('');

    if (!fundraiserName || !fundraiserGoal || !fundraiserStory || !fundraiserImage) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        setError('MetaMask not found. Please install it.');
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, contractABI, signer);

      const goalInMicro = Math.floor(Number(fundraiserGoal) * 1e6);

      setStatus('Creating fundraiser... please confirm the transaction in MetaMask.');

      // Example contract call
      const endDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
      const tx = await contract.addFundraiser(
        endDate,
        fundraiserName,
        fundraiserStory,
        goalInMicro
      );

      await tx.wait();

      setStatus('Fundraiser created successfully!');

      // Clear form
      setFundraiserName('');
      setFundraiserGoal('');
      setFundraiserStory('');
      setFundraiserImage('');

      console.log('Fundraiser image chosen:', fundraiserImage);
    } catch (err: any) {
      console.error('Error creating fundraiser:', err);
      setError(err.message || 'Transaction failed');
    }
  }

  return (
    <>
      <Head>
        <title>Create a Fundraiser</title>
        <meta name="description" content="Launch a new fundraiser on Helping Hands" />
      </Head>

      <Navbar />

      {/* 
        Background gradient from dark gray to black, 
        with a subtle hero-like banner at top
      */}
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
        <section className="max-w-7xl mx-auto px-4 py-12">
          {/* Hero / Intro Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Start a New Fundraiser</h1>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Make a difference by creating a fundraiser to support your cause. 
              Share your story, set a goal, and rally your community behind you!
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-[rgba(255,255,255,0.1)] rounded-lg shadow-lg max-w-3xl mx-auto p-8">
            <h2 className="text-2xl font-semibold mb-6 text-center">Your Fundraiser Details</h2>

            {/* Fundraiser Name */}
            <div className="mb-6">
              <label className="block mb-2 font-semibold text-gray-200">Fundraiser Name</label>
              <input
                type="text"
                value={fundraiserName}
                onChange={(e) => setFundraiserName(e.target.value)}
                className="
                  w-full
                  px-4
                  py-2
                  rounded
                  bg-white
                  text-black
                  placeholder-gray-500
                  border
                  border-gray-300
                  focus:outline-none
                  focus:ring-2
                  focus:ring-green-400
                  focus:border-transparent
                "
                placeholder="e.g. Help John with medical bills"
              />
            </div>

            {/* Fundraiser Goal */}
            <div className="mb-6">
              <label className="block mb-2 font-semibold text-gray-200">Fundraiser Goal (USD)</label>
              <input
                type="number"
                value={fundraiserGoal}
                onChange={(e) => setFundraiserGoal(e.target.value)}
                className="
                  w-full
                  px-4
                  py-2
                  rounded
                  bg-white
                  text-black
                  placeholder-gray-500
                  border
                  border-gray-300
                  focus:outline-none
                  focus:ring-2
                  focus:ring-green-400
                  focus:border-transparent
                "
                placeholder="e.g. 5000"
              />
            </div>

            {/* Fundraiser Story */}
            <div className="mb-6">
              <label className="block mb-2 font-semibold text-gray-200">Your Story</label>
              <textarea
                value={fundraiserStory}
                onChange={(e) => setFundraiserStory(e.target.value)}
                className="
                  w-full
                  px-4
                  py-2
                  rounded
                  bg-white
                  text-black
                  placeholder-gray-500
                  border
                  border-gray-300
                  focus:outline-none
                  focus:ring-2
                  focus:ring-green-400
                  focus:border-transparent
                "
                rows={5}
                placeholder="Explain why you're fundraising, how donations will be used, and why it's important..."
              />
            </div>

            {/* Fundraiser Image */}
            <div className="mb-6">
              <label className="block mb-2 font-semibold text-gray-200">Image URL</label>
              <input
                type="text"
                value={fundraiserImage}
                onChange={(e) => setFundraiserImage(e.target.value)}
                className="
                  w-full
                  px-4
                  py-2
                  rounded
                  bg-white
                  text-black
                  placeholder-gray-500
                  border
                  border-gray-300
                  focus:outline-none
                  focus:ring-2
                  focus:ring-green-400
                  focus:border-transparent
                "
                placeholder="e.g. https://example.com/my-image.jpg"
              />
            </div>

            {/* Display any error/status messages */}
            {error && <p className="text-red-400 mb-4">{error}</p>}
            {status && <p className="text-green-400 mb-4">{status}</p>}

            <div className="text-center">
              <button
                onClick={handleCreateFundraiser}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-8 rounded-md font-semibold text-lg"
              >
                Launch Fundraiser
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
