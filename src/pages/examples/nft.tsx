import { useState } from 'react'
import { useAccount, useContractRead, useContractWrite } from 'wagmi'
import { parseAbi } from 'viem'
import Head from 'next/head'
import { Navbar } from '@/components/Navbar'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function NFTExample() {
  const [tokenId, setTokenId] = useState<string>('')
  const { address } = useAccount()

  // Example NFT contract - replace with your contract address
  const CONTRACT_ADDRESS = '0xYourNFTContractAddress'
  const CONTRACT_ABI = parseAbi([
    'function mint(address to, uint256 tokenId) public',
    'function balanceOf(address owner) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ])

  const { data: balance } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`]
  })

  const { writeContract, isPending: isLoading, isSuccess } = useContractWrite()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Head>
        <title>NFT Example | CampBuidl</title>
        <meta content="Example of NFT contract interactions" name="description" />
      </Head>

      <Navbar />

      <main className="container mx-auto p-8 max-w-4xl">
        <div className="text-center mb-16 py-12 px-4">
          <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            NFT Contract Example
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Learn how to interact with NFT contracts, including minting and checking balances.
          </p>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Your NFT Balance</CardTitle>
              <CardDescription>View your current NFT holdings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl">{balance?.toString() || '0'} NFTs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mint NFT</CardTitle>
              <CardDescription>Create a new NFT by specifying a token ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Token ID</label>
                <input
                  type="number"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  className="border rounded px-3 py-2 w-full max-w-xs"
                  placeholder="Enter token ID"
                />
              </div>
              <button
                onClick={() => writeContract({
                  address: CONTRACT_ADDRESS as `0x${string}`,
                  abi: CONTRACT_ABI,
                  functionName: 'mint',
                  args: [address as `0x${string}`, BigInt(tokenId || '0')]
                })}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {isLoading ? 'Minting...' : 'Mint NFT'}
              </button>
              {isSuccess && (
                <div className="text-green-500">
                  Successfully minted NFT!
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Code Example</CardTitle>
              <CardDescription>Learn how to interact with NFT contracts</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-black p-4 rounded-lg overflow-x-auto">
                <code className="text-sm text-blue-50">{`// Mint NFT Example
const { writeContract } = useContractWrite();

writeContract({
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: 'mint',
  args: [address, tokenId]
});`}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
